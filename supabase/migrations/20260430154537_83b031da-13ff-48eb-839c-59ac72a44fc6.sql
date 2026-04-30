-- ============ Content Pages ============
CREATE TABLE IF NOT EXISTS public.content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_ar TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  meta_description_ar TEXT,
  meta_description_en TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  show_in_footer BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published pages"
  ON public.content_pages FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all pages"
  ON public.content_pages FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_manager'));

CREATE POLICY "Admins can insert pages"
  ON public.content_pages FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_manager'));

CREATE POLICY "Admins can update pages"
  ON public.content_pages FOR UPDATE
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_manager'));

CREATE POLICY "Admins can delete pages"
  ON public.content_pages FOR DELETE
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER content_pages_updated_at
  BEFORE UPDATE ON public.content_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Marketing Campaigns ============
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'banner',
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  coupon_code TEXT,
  target_audience TEXT NOT NULL DEFAULT 'all',
  banner_image_url TEXT,
  banner_link_url TEXT,
  email_subject TEXT,
  email_body TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing team can view campaigns"
  ON public.marketing_campaigns FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing_manager'));

CREATE POLICY "Marketing team can insert campaigns"
  ON public.marketing_campaigns FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing_manager'));

CREATE POLICY "Marketing team can update campaigns"
  ON public.marketing_campaigns FOR UPDATE
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing_manager'));

CREATE POLICY "Admins can delete campaigns"
  ON public.marketing_campaigns FOR DELETE
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Admin Help Articles ============
CREATE TABLE IF NOT EXISTS public.admin_help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'guide',
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_ar TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  external_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any admin staff can view help articles"
  ON public.admin_help_articles FOR SELECT
  USING (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'store_manager') OR public.has_role(auth.uid(),'orders_manager')
    OR public.has_role(auth.uid(),'support') OR public.has_role(auth.uid(),'inventory_manager')
    OR public.has_role(auth.uid(),'marketing_manager') OR public.has_role(auth.uid(),'finance_manager')
    OR public.has_role(auth.uid(),'content_manager') OR public.has_role(auth.uid(),'developer')
    OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff')
    OR public.has_role(auth.uid(),'viewer')
  );

CREATE POLICY "Admins can manage help articles"
  ON public.admin_help_articles FOR ALL
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER admin_help_articles_updated_at
  BEFORE UPDATE ON public.admin_help_articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Seed default content ============
INSERT INTO public.content_pages (slug, title_ar, title_en, body_ar, body_en, is_published, show_in_footer, sort_order) VALUES
  ('about', 'من نحن', 'About Us', 'Le Petit Paradis متجر فاخر لملابس وإكسسوارات الأطفال…', 'Le Petit Paradis is a luxury boutique for children clothing and accessories…', true, true, 1),
  ('shipping', 'سياسة الشحن', 'Shipping Policy', 'نشحن إلى جميع مدن المملكة خلال 2-5 أيام عمل…', 'We ship across Saudi Arabia within 2-5 business days…', true, true, 2),
  ('returns', 'سياسة الاسترجاع', 'Returns Policy', 'يمكن استرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام…', 'Products can be returned within 14 days of delivery…', true, true, 3),
  ('contact', 'تواصل معنا', 'Contact Us', 'البريد: support@lppme.com\nالهاتف: +966...', 'Email: support@lppme.com\nPhone: +966...', true, true, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.admin_help_articles (category, title_ar, title_en, body_ar, body_en, sort_order) VALUES
  ('guide', 'كيف تنشئ طلب يدوي', 'How to create a manual order', 'من القائمة الجانبية اختر "إنشاء طلب" ثم أضف المنتجات…', 'From the sidebar, choose "Create order" then add products…', 1),
  ('guide', 'إدارة المخزون', 'Manage inventory', 'افتح صفحة المخزون لرؤية الكميات وضبط حدود التنبيه…', 'Open the Inventory page to view quantities and set low-stock thresholds…', 2),
  ('faq', 'كيف أضيف موظف جديد؟', 'How do I add a new staff member?', 'من "المستخدمون والصلاحيات" أنشئ مستخدماً جديداً وحدد دوره…', 'From "Users & roles" create a new user and assign a role…', 10),
  ('faq', 'هل يمكن تصدير التقارير؟', 'Can I export reports?', 'نعم، من صفحة التقارير الشاملة استخدم زر التصدير CSV.', 'Yes, from the Reports page use the CSV export button.', 11)
ON CONFLICT DO NOTHING;