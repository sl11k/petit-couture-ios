-- Update validate_coupon to support included_category_ids.
DROP FUNCTION IF EXISTS public.validate_coupon(text, jsonb, uuid, text);

CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _cart_items jsonb,
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
  item jsonb;
  eligible_subtotal numeric := 0;
  total_subtotal numeric := 0;
  item_price numeric;
  item_qty numeric;
  item_id text;
  item_discounted boolean;
  is_eligible boolean;
  item_cats uuid[];
  has_category_filter boolean;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN QUERY SELECT false, 'empty_code', NULL::uuid, NULL::text, NULL::text, NULL::numeric, 0::numeric; RETURN;
  END IF;

  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::uuid, NULL::text, NULL::text, NULL::numeric, 0::numeric; RETURN;
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
  IF c.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO user_uses FROM public.coupon_redemptions r
      WHERE r.coupon_id = c.id
        AND ((_user_id IS NOT NULL AND r.user_id = _user_id)
          OR (_customer_email IS NOT NULL AND lower(r.customer_email) = lower(_customer_email)));
    IF user_uses >= c.per_customer_limit THEN
      RETURN QUERY SELECT false, 'per_customer_limit', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
    END IF;
  END IF;

  IF c.allowed_user_ids IS NOT NULL AND jsonb_array_length(c.allowed_user_ids) > 0 THEN
    IF _user_id IS NULL AND _customer_email IS NULL THEN
      RETURN QUERY SELECT false, 'not_allowed_user', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
    END IF;
    IF NOT ((_user_id::text) IN (SELECT jsonb_array_elements_text(c.allowed_user_ids))) THEN
      IF NOT (_customer_email IN (SELECT jsonb_array_elements_text(c.allowed_user_ids))) THEN
         RETURN QUERY SELECT false, 'not_allowed_user', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
      END IF;
    END IF;
  END IF;

  has_category_filter := c.included_category_ids IS NOT NULL AND jsonb_array_length(c.included_category_ids) > 0;

  FOR item IN SELECT * FROM jsonb_array_elements(_cart_items)
  LOOP
    item_id := item->>'product_id';
    item_price := (item->>'price')::numeric;
    item_qty := (item->>'qty')::numeric;
    item_discounted := coalesce((item->>'is_discounted')::boolean, false);
    total_subtotal := total_subtotal + (item_price * item_qty);
    is_eligible := true;

    IF c.exclude_discounted_products AND item_discounted THEN is_eligible := false; END IF;

    IF is_eligible AND c.excluded_product_ids IS NOT NULL AND jsonb_array_length(c.excluded_product_ids) > 0 THEN
      IF item_id IN (SELECT jsonb_array_elements_text(c.excluded_product_ids)) THEN is_eligible := false; END IF;
    END IF;

    IF is_eligible AND c.included_product_ids IS NOT NULL AND jsonb_array_length(c.included_product_ids) > 0 THEN
      IF NOT (item_id IN (SELECT jsonb_array_elements_text(c.included_product_ids))) THEN is_eligible := false; END IF;
    END IF;

    IF is_eligible AND has_category_filter AND item_id IS NOT NULL THEN
      -- Collect all category ids for this product (primary + join tables).
      SELECT array_agg(DISTINCT cid) INTO item_cats FROM (
        SELECT category_id AS cid FROM public.products WHERE id = item_id::uuid AND category_id IS NOT NULL
        UNION
        SELECT category_id FROM public.product_categories WHERE product_id = item_id::uuid
        UNION
        SELECT category_id FROM public.category_products WHERE product_id = item_id::uuid
      ) x;
      IF item_cats IS NULL OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(c.included_category_ids) t(v)
        WHERE v::uuid = ANY(item_cats)
      ) THEN
        is_eligible := false;
      END IF;
    END IF;

    IF is_eligible THEN eligible_subtotal := eligible_subtotal + (item_price * item_qty); END IF;
  END LOOP;

  IF eligible_subtotal = 0 THEN
    RETURN QUERY SELECT false, 'no_eligible_items', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;

  IF c.min_subtotal IS NOT NULL AND total_subtotal < c.min_subtotal THEN
    RETURN QUERY SELECT false, 'min_subtotal', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;

  IF c.discount_type = 'percent' OR c.discount_type = 'percentage' THEN
    computed := round((eligible_subtotal * c.discount_value / 100.0)::numeric, 2);
  ELSE
    computed := c.discount_value;
  END IF;

  IF computed > eligible_subtotal THEN computed := eligible_subtotal; END IF;
  IF computed < 0 THEN computed := 0; END IF;

  RETURN QUERY SELECT true, 'ok'::text, c.id, c.code, c.discount_type, c.discount_value, computed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, jsonb, uuid, text) TO anon, authenticated, service_role;