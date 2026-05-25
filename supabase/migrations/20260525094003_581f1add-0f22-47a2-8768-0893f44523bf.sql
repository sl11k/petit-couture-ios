
-- 1. abandoned_carts
DROP POLICY IF EXISTS "Anyone update own cart by session" ON public.abandoned_carts;
CREATE POLICY "Owners or staff update carts" ON public.abandoned_carts
  FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- 2. coupon_redemptions
DROP POLICY IF EXISTS "Anyone insert redemption" ON public.coupon_redemptions;
CREATE POLICY "Authenticated insert own redemption" ON public.coupon_redemptions
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND (user_id IS NULL OR auth.uid() = user_id))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  );

-- 3. coupons
DROP POLICY IF EXISTS "Public can read coupons for validation" ON public.coupons;

-- 4. inventory_alerts
DROP POLICY IF EXISTS "Anyone insert alert" ON public.inventory_alerts;
CREATE POLICY "Authenticated insert own alert" ON public.inventory_alerts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR auth.uid() = user_id)
  );

-- 5. push_subscriptions
DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "Users select own push subs" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own push subs" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "Users update own push subs" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own push subs" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 6. webhook_deliveries
DROP POLICY IF EXISTS "System updates deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admins update deliveries" ON public.webhook_deliveries
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 7. user_roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Super admins manage all roles" ON public.user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins manage non-super roles" ON public.user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role);

-- 8. site_settings
DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Privileged read settings" ON public.site_settings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'store_manager'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'viewer'::app_role)
  );

CREATE OR REPLACE VIEW public.public_site_settings
WITH (security_invoker = true) AS
SELECT
  id, store_name, hero_title_en, hero_title_ar, hero_subtitle_en, hero_subtitle_ar,
  hero_image_url, primary_color, whatsapp_number, support_email,
  free_shipping_threshold, shipping_fee, tax_rate, announcement_bar,
  company_legal_name, tax_number, commercial_register,
  store_address, store_city, store_country, store_phone,
  invoice_logo_url, invoice_prefix, invoice_footer_note,
  tax_inclusive, tax_label, currency_code, currency_symbol,
  issue_tax_invoice, auto_issue_on_payment,
  logo_url, favicon_url,
  social_instagram, social_twitter, social_facebook, social_tiktok, social_snapchat, social_youtube,
  supported_languages, default_language,
  shipping_policy, return_policy, privacy_policy, terms_of_service,
  min_order_amount, order_auto_confirm, order_payment_timeout_minutes, guest_checkout_enabled,
  inventory_low_stock_threshold, inventory_hide_when_out, inventory_allow_backorder, inventory_reserve_on_checkout,
  notify_admin_new_order, notify_admin_low_stock, notify_customer_order_status,
  notify_channel_email, notify_channel_sms, notify_channel_whatsapp,
  seo_title, seo_description, seo_keywords, seo_og_image, seo_robots,
  privacy_cookie_banner, privacy_marketing_consent, privacy_data_retention_days,
  maintenance_mode, maintenance_message,
  loyalty_enabled, loyalty_points_per_currency, loyalty_redeem_rate, loyalty_signup_bonus,
  referral_enabled, referral_referrer_reward, referral_referred_reward,
  show_trust_badges, trust_badges, upsell_enabled,
  abandoned_cart_recovery_enabled, abandoned_cart_delay_minutes,
  updated_at
FROM public.site_settings;

GRANT SELECT ON public.public_site_settings TO anon, authenticated;

-- 9. unsubscribe_tokens
DROP POLICY IF EXISTS "Tokens readable by anyone" ON public.unsubscribe_tokens;
DROP POLICY IF EXISTS "Tokens updatable by anyone" ON public.unsubscribe_tokens;
CREATE POLICY "Admins read tokens" ON public.unsubscribe_tokens
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'marketing_manager'::app_role)
  );

CREATE OR REPLACE FUNCTION public.redeem_unsubscribe_token(_token text)
RETURNS TABLE(status text, email text, channel text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec public.unsubscribe_tokens%ROWTYPE;
BEGIN
  SELECT * INTO _rec FROM public.unsubscribe_tokens WHERE token = _token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF _rec.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already'::text, _rec.email, _rec.channel;
    RETURN;
  END IF;
  UPDATE public.unsubscribe_tokens SET used_at = now() WHERE token = _token;
  IF _rec.user_id IS NOT NULL THEN
    IF _rec.channel = 'email' THEN
      INSERT INTO public.customer_consents(user_id, marketing_email, source, updated_at)
      VALUES (_rec.user_id, false, 'unsubscribe_link', now())
      ON CONFLICT (user_id) DO UPDATE SET marketing_email = false, source = 'unsubscribe_link', updated_at = now();
    ELSIF _rec.channel = 'sms' THEN
      INSERT INTO public.customer_consents(user_id, marketing_sms, source, updated_at)
      VALUES (_rec.user_id, false, 'unsubscribe_link', now())
      ON CONFLICT (user_id) DO UPDATE SET marketing_sms = false, source = 'unsubscribe_link', updated_at = now();
    ELSIF _rec.channel = 'whatsapp' THEN
      INSERT INTO public.customer_consents(user_id, marketing_whatsapp, source, updated_at)
      VALUES (_rec.user_id, false, 'unsubscribe_link', now())
      ON CONFLICT (user_id) DO UPDATE SET marketing_whatsapp = false, source = 'unsubscribe_link', updated_at = now();
    END IF;
  END IF;
  RETURN QUERY SELECT 'ok'::text, _rec.email, _rec.channel;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_unsubscribe_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_unsubscribe_token(text) TO anon, authenticated;

-- 10. return-photos bucket
UPDATE storage.buckets SET public = false WHERE id = 'return-photos';
DROP POLICY IF EXISTS "Public read return photos" ON storage.objects;
CREATE POLICY "Owners and staff read return photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'return-photos'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  );
