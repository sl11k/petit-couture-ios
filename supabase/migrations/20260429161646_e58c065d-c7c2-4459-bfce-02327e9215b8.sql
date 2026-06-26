-- 1) Storefront Banners (slider banners on homepage)
CREATE TABLE public.storefront_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title_ar TEXT,
  title_en TEXT,
  subtitle_ar TEXT,
  subtitle_en TEXT,
  eyebrow_ar TEXT,
  eyebrow_en TEXT,
  cta_label_ar TEXT,
  cta_label_en TEXT,
  cta_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Featured Categories (the "ages" section: babies/girls/boys etc.)
CREATE TABLE public.featured_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Popular Picks ("الأكثر شهرة" cards on homepage)
CREATE TABLE public.popular_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Announcement Messages (the rotating top bar)
CREATE TABLE public.announcement_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_ar TEXT NOT NULL,
  message_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Storefront Settings (singleton row)
CREATE TABLE public.storefront_settings (
  id BOOLEAN NOT NULL DEFAULT true PRIMARY KEY CHECK (id = true),
  banner_autoplay_seconds INTEGER NOT NULL DEFAULT 5,
  announcement_rotate_seconds INTEGER NOT NULL DEFAULT 4,
  footer_about_ar TEXT,
  footer_about_en TEXT,
  footer_phone TEXT DEFAULT '+96655 740 4827',
  footer_email TEXT,
  footer_address_ar TEXT,
  footer_address_en TEXT,
  footer_instagram TEXT,
  footer_tiktok TEXT,
  footer_whatsapp TEXT DEFAULT 'https://wa.me/966557404827',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all
ALTER TABLE public.storefront_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popular_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_settings ENABLE ROW LEVEL SECURITY;

-- Public read of active rows; full read for staff
CREATE POLICY "Public can view active banners" ON public.storefront_banners
  FOR SELECT USING (is_active = true OR public.has_permission(auth.uid(), 'storefront.manage'));
CREATE POLICY "Staff manage banners" ON public.storefront_banners
  FOR ALL USING (public.has_permission(auth.uid(), 'storefront.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'storefront.manage'));

CREATE POLICY "Public can view active featured categories" ON public.featured_categories
  FOR SELECT USING (is_active = true OR public.has_permission(auth.uid(), 'storefront.manage'));
CREATE POLICY "Staff manage featured categories" ON public.featured_categories
  FOR ALL USING (public.has_permission(auth.uid(), 'storefront.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'storefront.manage'));

CREATE POLICY "Public can view active popular picks" ON public.popular_picks
  FOR SELECT USING (is_active = true OR public.has_permission(auth.uid(), 'storefront.manage'));
CREATE POLICY "Staff manage popular picks" ON public.popular_picks
  FOR ALL USING (public.has_permission(auth.uid(), 'storefront.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'storefront.manage'));

CREATE POLICY "Public can view active announcements" ON public.announcement_messages
  FOR SELECT USING (is_active = true OR public.has_permission(auth.uid(), 'storefront.manage'));
CREATE POLICY "Staff manage announcements" ON public.announcement_messages
  FOR ALL USING (public.has_permission(auth.uid(), 'storefront.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'storefront.manage'));

CREATE POLICY "Public can view storefront settings" ON public.storefront_settings
  FOR SELECT USING (true);
CREATE POLICY "Staff manage storefront settings" ON public.storefront_settings
  FOR ALL USING (public.has_permission(auth.uid(), 'storefront.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'storefront.manage'));

-- Grant the manage permission to admin/manager roles
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'storefront.manage'),
  ('manager', 'storefront.manage'),
  ('super_admin', 'storefront.manage')
ON CONFLICT DO NOTHING;

-- updated_at triggers
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON public.storefront_banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_featured_cats_updated BEFORE UPDATE ON public.featured_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_popular_updated BEFORE UPDATE ON public.popular_picks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON public.announcement_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_storefront_settings_updated BEFORE UPDATE ON public.storefront_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for storefront images (banners, popular picks, featured categories)
INSERT INTO storage.buckets (id, name, public) VALUES ('storefront', 'storefront', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read storefront images" ON storage.objects
  FOR SELECT USING (bucket_id = 'storefront');
CREATE POLICY "Staff can upload storefront images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'storefront' AND public.has_permission(auth.uid(), 'storefront.manage'));
CREATE POLICY "Staff can update storefront images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'storefront' AND public.has_permission(auth.uid(), 'storefront.manage'));
CREATE POLICY "Staff can delete storefront images" ON storage.objects
  FOR DELETE USING (bucket_id = 'storefront' AND public.has_permission(auth.uid(), 'storefront.manage'));

-- Seed initial settings row
INSERT INTO public.storefront_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Seed default announcements (current hardcoded values)
INSERT INTO public.announcement_messages (message_ar, message_en, sort_order) VALUES
  ('اشترِ الآن وادفع لاحقًا مع تمارا', 'Buy Now, Pay Later with Tamara', 1),
  ('تسوّق وادفع بالريال السعودي', 'Shop and pay in Saudi Riyal (SAR)', 2),
  ('أضف عنوانك الوطني السعودي للتوصيل الأسرع', 'Add your Saudi National Address for faster delivery', 3);

-- Seed default featured categories
INSERT INTO public.featured_categories (label_ar, label_en, link_url, sort_order) VALUES
  ('رضّع', 'Babies', '/category/babysuits', 1),
  ('بنات', 'Girls', '/category/dresses', 2),
  ('أولاد', 'Boys', '/category/outfit-sets', 3);
