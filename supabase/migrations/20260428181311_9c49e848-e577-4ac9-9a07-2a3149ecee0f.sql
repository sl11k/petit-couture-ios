-- 1) Reviews (with verification & moderation)
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid,
  customer_name text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_purchase boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id, status);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "Users insert own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own reviews" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage reviews" ON public.reviews FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'store_manager') OR public.has_permission(auth.uid(),'products.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'store_manager') OR public.has_permission(auth.uid(),'products.manage')
);
CREATE TRIGGER reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Manual product recommendations (similar / complementary / upsell / cross-sell)
CREATE TABLE IF NOT EXISTS public.product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  recommended_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'similar', -- similar|complementary|upsell|cross_sell
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, recommended_id, type)
);
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read recos" ON public.product_recommendations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage recos" ON public.product_recommendations FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'products.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'products.manage')
);

-- 3) Bundles (buy these N items together for a price/discount)
CREATE TABLE IF NOT EXISTS public.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  bundle_price numeric(12,2),
  discount_percent numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active bundles" ON public.bundles FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage bundles" ON public.bundles FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'products.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'products.manage')
);
CREATE TRIGGER bundles_updated BEFORE UPDATE ON public.bundles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Loyalty points
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze', -- bronze|silver|gold|platinum
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL, -- earn_order|redeem|signup_bonus|referral|review|adjustment
  related_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON public.loyalty_transactions(user_id, created_at DESC);
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage loyalty" ON public.loyalty_accounts FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'customers.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'customers.manage')
);
CREATE POLICY "Users view own loyalty tx" ON public.loyalty_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage loyalty tx" ON public.loyalty_transactions FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'customers.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'customers.manage')
);

-- 5) Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email text,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|signed_up|purchased|rewarded
  reward_amount numeric(12,2),
  reward_type text DEFAULT 'discount', -- discount|points
  related_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_user_id);
CREATE POLICY "Users insert own referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'customers.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'customers.manage')
);

-- 6) Landing pages
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  subtitle text,
  hero_image text,
  cta_text text,
  cta_url text,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  coupon_code text,
  utm_campaign text,
  is_active boolean NOT NULL DEFAULT true,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active landing" ON public.landing_pages FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage landing" ON public.landing_pages FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'storefront.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'storefront.manage')
);
CREATE TRIGGER landing_updated BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7) A/B tests
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL, -- e.g. 'home_hero' | 'pdp_cta' | 'checkout_button'
  variant_a jsonb NOT NULL DEFAULT '{}',
  variant_b jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  views_a integer NOT NULL DEFAULT 0,
  views_b integer NOT NULL DEFAULT 0,
  conversions_a integer NOT NULL DEFAULT 0,
  conversions_b integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active ab" ON public.ab_tests FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage ab" ON public.ab_tests FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'storefront.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'storefront.manage')
);

-- 8) Internal search logs
CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  results_count integer NOT NULL DEFAULT 0,
  user_id uuid,
  session_id text,
  clicked_product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.search_logs(query);
CREATE INDEX IF NOT EXISTS idx_search_logs_zero ON public.search_logs(query) WHERE results_count = 0;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log search" ON public.search_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read search logs" ON public.search_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'reports.view')
);

-- 9) Search synonyms / suggestions for empty results
CREATE TABLE IF NOT EXISTS public.search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  synonym text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read synonyms" ON public.search_synonyms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage synonyms" ON public.search_synonyms FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'storefront.manage')
) WITH CHECK (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'storefront.manage')
);

-- 10) Settings additions for conversion features
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS first_order_coupon_code text,
  ADD COLUMN IF NOT EXISTS first_order_coupon_discount numeric(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_currency numeric(6,2) NOT NULL DEFAULT 1, -- 1 pt / 1 SAR
  ADD COLUMN IF NOT EXISTS loyalty_redeem_rate numeric(6,2) NOT NULL DEFAULT 100, -- 100 pts = 1 SAR
  ADD COLUMN IF NOT EXISTS loyalty_signup_bonus integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_referrer_reward numeric(12,2) NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS referral_referred_reward numeric(12,2) NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS show_trust_badges boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trust_badges jsonb NOT NULL DEFAULT '["دفع آمن","شحن سريع","استرجاع خلال 14 يوم","ضمان الجودة"]'::jsonb,
  ADD COLUMN IF NOT EXISTS upsell_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS abandoned_cart_recovery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS abandoned_cart_delay_minutes integer NOT NULL DEFAULT 60;