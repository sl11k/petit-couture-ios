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
  item_id_text text;
  item_uuid uuid;
  item_discounted boolean;
  is_eligible boolean;
  item_cats uuid[];
  has_category_filter boolean;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN QUERY SELECT false, 'empty_code', NULL::uuid, NULL::text, NULL::text, NULL::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT cp.* INTO c
  FROM public.coupons AS cp
  WHERE upper(cp.code) = upper(trim(_code))
  ORDER BY cp.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::uuid, NULL::text, NULL::text, NULL::numeric, 0::numeric;
    RETURN;
  END IF;

  IF NOT coalesce(c.is_active, false) THEN
    RETURN QUERY SELECT false, 'inactive', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT false, 'not_started', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT false, 'expired', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF c.max_uses IS NOT NULL AND c.max_uses > 0 AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT false, 'usage_limit_reached', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF c.per_customer_limit IS NOT NULL AND c.per_customer_limit > 0 THEN
    SELECT count(*) INTO user_uses
    FROM public.coupon_redemptions AS r
    WHERE r.coupon_id = c.id
      AND (
        (_user_id IS NOT NULL AND r.user_id = _user_id)
        OR (_customer_email IS NOT NULL AND lower(r.customer_email) = lower(_customer_email))
      );

    IF user_uses >= c.per_customer_limit THEN
      RETURN QUERY SELECT false, 'per_customer_limit', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
      RETURN;
    END IF;
  END IF;

  IF coalesce(jsonb_array_length(coalesce(c.allowed_user_ids, '[]'::jsonb)), 0) > 0 THEN
    IF _user_id IS NULL AND _customer_email IS NULL THEN
      RETURN QUERY SELECT false, 'not_allowed_user', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
      RETURN;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(c.allowed_user_ids) AS allowed(value)
      WHERE (_user_id IS NOT NULL AND allowed.value = _user_id::text)
         OR (_customer_email IS NOT NULL AND lower(allowed.value) = lower(_customer_email))
    ) THEN
      RETURN QUERY SELECT false, 'not_allowed_user', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
      RETURN;
    END IF;
  END IF;

  has_category_filter := coalesce(jsonb_array_length(coalesce(c.included_category_ids, '[]'::jsonb)), 0) > 0;

  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(_cart_items, '[]'::jsonb))
  LOOP
    item_id_text := nullif(item->>'product_id', '');
    item_uuid := NULL;
    IF item_id_text IS NOT NULL AND item_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      item_uuid := item_id_text::uuid;
    END IF;

    item_price := greatest(coalesce(nullif(item->>'price', '')::numeric, 0), 0);
    item_qty := greatest(coalesce(nullif(item->>'qty', '')::numeric, 0), 0);
    item_discounted := coalesce(nullif(item->>'is_discounted', '')::boolean, false);

    IF item_qty <= 0 THEN
      CONTINUE;
    END IF;

    total_subtotal := total_subtotal + (item_price * item_qty);
    is_eligible := item_uuid IS NOT NULL;

    IF is_eligible AND coalesce(c.exclude_discounted_products, false) AND item_discounted THEN
      is_eligible := false;
    END IF;

    IF is_eligible AND coalesce(jsonb_array_length(coalesce(c.excluded_product_ids, '[]'::jsonb)), 0) > 0 THEN
      IF item_uuid::text IN (SELECT jsonb_array_elements_text(c.excluded_product_ids)) THEN
        is_eligible := false;
      END IF;
    END IF;

    IF is_eligible AND coalesce(jsonb_array_length(coalesce(c.included_product_ids, '[]'::jsonb)), 0) > 0 THEN
      IF NOT (item_uuid::text IN (SELECT jsonb_array_elements_text(c.included_product_ids))) THEN
        is_eligible := false;
      END IF;
    END IF;

    IF is_eligible AND has_category_filter THEN
      SELECT array_agg(DISTINCT cid) INTO item_cats
      FROM (
        SELECT p.category_id AS cid
        FROM public.products AS p
        WHERE p.id = item_uuid AND p.category_id IS NOT NULL
        UNION
        SELECT pc.category_id
        FROM public.product_categories AS pc
        WHERE pc.product_id = item_uuid
        UNION
        SELECT cp.category_id
        FROM public.category_products AS cp
        WHERE cp.product_id = item_uuid
      ) AS cats;

      IF item_cats IS NULL OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(c.included_category_ids) AS selected(value)
        WHERE selected.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND selected.value::uuid = ANY(item_cats)
      ) THEN
        is_eligible := false;
      END IF;
    END IF;

    IF is_eligible THEN
      eligible_subtotal := eligible_subtotal + (item_price * item_qty);
    END IF;
  END LOOP;

  IF total_subtotal <= 0 THEN
    RETURN QUERY SELECT false, 'empty_cart', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF eligible_subtotal <= 0 THEN
    RETURN QUERY SELECT false, 'no_eligible_items', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF c.min_subtotal IS NOT NULL AND c.min_subtotal > 0 AND total_subtotal < c.min_subtotal THEN
    RETURN QUERY SELECT false, 'min_subtotal', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF c.discount_type IN ('percent', 'percentage') THEN
    computed := round((eligible_subtotal * greatest(coalesce(c.discount_value, 0), 0) / 100.0)::numeric, 2);
  ELSIF c.discount_type = 'fixed' THEN
    computed := greatest(coalesce(c.discount_value, 0), 0);
  ELSIF c.discount_type = 'free_shipping' THEN
    computed := 0;
  ELSE
    RETURN QUERY SELECT false, 'unsupported_discount_type', c.id, c.code, c.discount_type, c.discount_value, 0::numeric;
    RETURN;
  END IF;

  IF computed > eligible_subtotal THEN
    computed := eligible_subtotal;
  END IF;
  IF computed < 0 THEN
    computed := 0;
  END IF;

  RETURN QUERY SELECT true, 'ok'::text, c.id, c.code, c.discount_type, c.discount_value, computed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, jsonb, uuid, text) TO anon, authenticated, service_role;