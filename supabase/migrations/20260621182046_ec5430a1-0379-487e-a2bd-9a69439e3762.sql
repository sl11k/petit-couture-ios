
-- 1) product_variants: remove blanket public-read policy
DROP POLICY IF EXISTS "product_variants_read" ON public.product_variants;

-- 2) idempotency_keys: tighten owner policies (remove NULL-user branch)
DROP POLICY IF EXISTS owner_select_idem ON public.idempotency_keys;
CREATE POLICY owner_select_idem ON public.idempotency_keys
  FOR SELECT
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS owner_update_idem ON public.idempotency_keys;
CREATE POLICY owner_update_idem ON public.idempotency_keys
  FOR UPDATE
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) shipping_carriers: restrict anon column access (hide api_credentials, webhook_secret_name)
REVOKE SELECT ON public.shipping_carriers FROM anon;
GRANT SELECT (
  id, code, name_ar, name_en, carrier_type, logo_url, is_active,
  supports_cod, supports_international, supports_tracking, supports_webhook,
  default_delivery_days_min, default_delivery_days_max, display_order,
  created_at, updated_at
) ON public.shipping_carriers TO anon;

-- 4) coupons: restrict anon column access (hide allowed_user_ids, revenue_total, discount_total)
REVOKE SELECT ON public.coupons FROM anon;
GRANT SELECT (
  id, code, description, discount_type, discount_value, min_subtotal,
  max_uses, used_count, starts_at, expires_at, is_active, created_at, updated_at,
  name, offer_type, bxgy_config, bundle_config, per_customer_limit, first_order_only,
  allowed_cities, allowed_payment_methods, allowed_shipping_zones,
  included_product_ids, excluded_product_ids, included_category_ids,
  no_combine, auto_apply, priority
) ON public.coupons TO anon;
