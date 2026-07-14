-- التحديثات المطلوبة على قاعدة البيانات لدعم الكوبونات المتقدمة

-- 1. إضافة حقل لاستثناء المنتجات المخفضة
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS exclude_discounted_products boolean DEFAULT false;

-- 2. إزالة الدالة القديمة لتحديث المدخلات (استبدال subtotal بـ cart_items لتمكين تصفية المنتجات)
DROP FUNCTION IF EXISTS public.validate_coupon(text, numeric, uuid, text);

-- 3. بناء الدالة الجديدة
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _cart_items jsonb, -- array of {"product_id": "...", "price": 100, "qty": 1, "is_discounted": false}
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

  -- إصلاح التواريخ لتعتمد على التوقيت العالمي الموحد بدون مشاكل
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

  -- تحقق من المستخدمين المحددين
  IF c.allowed_user_ids IS NOT NULL AND jsonb_array_length(c.allowed_user_ids) > 0 THEN
    -- إذا لم يكن هناك يوزر أو ايميل، فهو غير مسجل ولن يتمكن من استخدام كوبون مخصص
    IF _user_id IS NULL AND _customer_email IS NULL THEN
      RETURN QUERY SELECT false, 'not_allowed_user', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
    END IF;

    -- التحقق إذا كان اليوزر آي دي موجوداً في المصفوفة
    IF NOT ((_user_id::text) IN (SELECT jsonb_array_elements_text(c.allowed_user_ids))) THEN
      -- والتحقق من الإيميل أيضاً
      IF NOT (_customer_email IN (SELECT jsonb_array_elements_text(c.allowed_user_ids))) THEN
         RETURN QUERY SELECT false, 'not_allowed_user', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
      END IF;
    END IF;
  END IF;

  -- حساب المجموع القابل للخصم (تصفية المنتجات)
  FOR item IN SELECT * FROM jsonb_array_elements(_cart_items)
  LOOP
    item_id := item->>'product_id';
    item_price := (item->>'price')::numeric;
    item_qty := (item->>'qty')::numeric;
    item_discounted := (item->>'is_discounted')::boolean;
    
    total_subtotal := total_subtotal + (item_price * item_qty);
    is_eligible := true;

    -- استثناء المنتجات المخفضة
    IF c.exclude_discounted_products AND item_discounted THEN
      is_eligible := false;
    END IF;

    -- استثناء منتجات معينة
    IF is_eligible AND c.excluded_product_ids IS NOT NULL AND jsonb_array_length(c.excluded_product_ids) > 0 THEN
      IF item_id IN (SELECT jsonb_array_elements_text(c.excluded_product_ids)) THEN
        is_eligible := false;
      END IF;
    END IF;

    -- شمول منتجات معينة فقط
    IF is_eligible AND c.included_product_ids IS NOT NULL AND jsonb_array_length(c.included_product_ids) > 0 THEN
      IF NOT (item_id IN (SELECT jsonb_array_elements_text(c.included_product_ids))) THEN
        is_eligible := false;
      END IF;
    END IF;

    IF is_eligible THEN
      eligible_subtotal := eligible_subtotal + (item_price * item_qty);
    END IF;
  END LOOP;

  -- إذا كان المجموع القابل للخصم 0، فهذا يعني أن الكوبون لا ينطبق على أي منتج في السلة
  IF eligible_subtotal = 0 THEN
    RETURN QUERY SELECT false, 'no_eligible_items', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;

  IF c.min_subtotal IS NOT NULL AND total_subtotal < c.min_subtotal THEN
    RETURN QUERY SELECT false, 'min_subtotal', c.id, c.code, c.discount_type, c.discount_value, 0::numeric; RETURN;
  END IF;

  -- حساب قيمة الخصم بناءً على المجموع القابل للخصم فقط
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

GRANT EXECUTE ON FUNCTION public.validate_coupon(text, jsonb, uuid, text) TO anon, authenticated;
