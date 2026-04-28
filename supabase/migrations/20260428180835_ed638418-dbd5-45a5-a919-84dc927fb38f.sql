ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  -- Social links
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_twitter text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_tiktok text,
  ADD COLUMN IF NOT EXISTS social_snapchat text,
  ADD COLUMN IF NOT EXISTS social_youtube text,
  -- Languages
  ADD COLUMN IF NOT EXISTS supported_languages text[] NOT NULL DEFAULT '{ar,en}',
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'ar',
  -- Policies
  ADD COLUMN IF NOT EXISTS shipping_policy text,
  ADD COLUMN IF NOT EXISTS return_policy text,
  ADD COLUMN IF NOT EXISTS privacy_policy text,
  ADD COLUMN IF NOT EXISTS terms_of_service text,
  -- Order
  ADD COLUMN IF NOT EXISTS min_order_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_auto_confirm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_payment_timeout_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS guest_checkout_enabled boolean NOT NULL DEFAULT true,
  -- Inventory
  ADD COLUMN IF NOT EXISTS inventory_low_stock_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS inventory_hide_when_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_allow_backorder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_reserve_on_checkout boolean NOT NULL DEFAULT true,
  -- Notifications
  ADD COLUMN IF NOT EXISTS notify_admin_new_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_admin_low_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_customer_order_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_channel_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_channel_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_channel_whatsapp boolean NOT NULL DEFAULT false,
  -- SEO
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS seo_og_image text,
  ADD COLUMN IF NOT EXISTS seo_robots text NOT NULL DEFAULT 'index,follow',
  -- Privacy
  ADD COLUMN IF NOT EXISTS privacy_cookie_banner boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_marketing_consent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_data_retention_days integer NOT NULL DEFAULT 365,
  -- Maintenance
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text DEFAULT 'المتجر تحت الصيانة، نعتذر عن الإزعاج.',
  ADD COLUMN IF NOT EXISTS maintenance_allowed_ips text[] DEFAULT '{}',
  -- Backup
  ADD COLUMN IF NOT EXISTS backup_auto_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_frequency text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS backup_email text,
  ADD COLUMN IF NOT EXISTS backup_last_run_at timestamptz;

-- Allow super_admin/store_manager too
DROP POLICY IF EXISTS "Admins update settings" ON public.site_settings;
CREATE POLICY "Privileged update settings"
  ON public.site_settings FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'store_manager')
  );

-- Audit changes to settings
DROP TRIGGER IF EXISTS audit_site_settings ON public.site_settings;
CREATE TRIGGER audit_site_settings
  AFTER UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();