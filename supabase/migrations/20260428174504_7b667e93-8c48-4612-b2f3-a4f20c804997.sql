-- Extend coupons with flexible offer types and conditions
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS offer_type text NOT NULL DEFAULT 'coupon',
  ADD COLUMN IF NOT EXISTS bxgy_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bundle_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS per_customer_limit integer,
  ADD COLUMN IF NOT EXISTS first_order_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_shipping_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS included_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS included_category_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS no_combine boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;

-- Coupon redemption log
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL,
  order_id uuid,
  user_id uuid,
  customer_email text,
  customer_phone text,
  discount_amount numeric NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON public.coupon_redemptions(user_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins read redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'viewer'::app_role));

DROP POLICY IF EXISTS "Anyone insert redemption" ON public.coupon_redemptions;
CREATE POLICY "Anyone insert redemption" ON public.coupon_redemptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users view own redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);