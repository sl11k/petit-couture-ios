
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;

-- Allow public read of coupons so customers can validate codes at checkout.
-- Existing admin-write policy stays unchanged.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Public can read coupons for validation'
  ) THEN
    CREATE POLICY "Public can read coupons for validation"
      ON public.coupons FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Secure validation function. Returns one row: valid, reason, discount_amount, coupon_id.
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _subtotal numeric,
  _user_id uuid DEFAULT NULL,
  _customer_email text DEFAULT NULL
)
RETURNS TABLE(
  valid boolean,
  reason text,
  coupon_id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  discount_amount numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  user_uses int;
  computed numeric := 0;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN QUERY SELECT false, 'empty_code', NULL::uuid, NULL::text, NULL::text, NULL::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::uuid, NULL::text, NULL::text, NULL::numeric, 0::numeric;
    RETURN;
  END IF;

  IF NOT c.is_active THEN
    RETURN QUERY SELECT false, 'inactive', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT false, 'not_started', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT false, 'expired', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT false, 'usage_limit_reached', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;
  IF c.min_subtotal IS NOT NULL AND _subtotal < c.min_subtotal THEN
    RETURN QUERY SELECT false, 'min_subtotal', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;

  IF c.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO user_uses FROM public.coupon_redemptions r
      WHERE r.coupon_id = c.id
        AND ((_user_id IS NOT NULL AND r.user_id = _user_id)
          OR (_customer_email IS NOT NULL AND lower(r.customer_email) = lower(_customer_email)));
    IF user_uses >= c.per_customer_limit THEN
      RETURN QUERY SELECT false, 'per_customer_limit', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
    END IF;
  END IF;

  -- compute discount
  IF c.discount_type = 'percent' OR c.discount_type = 'percentage' THEN
    computed := round((_subtotal * c.discount_value / 100.0)::numeric, 2);
  ELSE
    computed := c.discount_value;
  END IF;
  IF computed > _subtotal THEN computed := _subtotal; END IF;
  IF computed < 0 THEN computed := 0; END IF;

  RETURN QUERY SELECT true, 'ok'::text, c.id, c.code, c.discount_type, c.discount_value, computed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric, uuid, text) TO anon, authenticated;
