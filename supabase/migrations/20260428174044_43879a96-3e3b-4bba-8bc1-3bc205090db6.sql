
-- الثيم
CREATE TABLE public.site_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT false,
  -- ألوان (HSL strings مثل "30 50% 50%")
  colors jsonb NOT NULL DEFAULT '{
    "primary": "30 50% 45%",
    "primary_foreground": "0 0% 100%",
    "secondary": "30 20% 95%",
    "accent": "40 60% 60%",
    "background": "0 0% 100%",
    "foreground": "0 0% 10%",
    "muted": "30 10% 95%",
    "border": "30 10% 90%"
  }'::jsonb,
  -- خطوط
  fonts jsonb NOT NULL DEFAULT '{
    "sans": "Inter",
    "serif": "Cormorant Garamond",
    "arabic": "Noto Kufi Arabic"
  }'::jsonb,
  -- العلامة التجارية
  branding jsonb NOT NULL DEFAULT '{
    "logo_url": null,
    "logo_dark_url": null,
    "favicon_url": null,
    "site_name": "Maisonnét"
  }'::jsonb,
  -- مكونات
  components jsonb NOT NULL DEFAULT '{
    "button_radius": "0.5rem",
    "button_style": "filled",
    "card_radius": "0.75rem",
    "card_style": "elevated",
    "header_style": "solid",
    "header_sticky": true,
    "footer_style": "rich",
    "home_layout": "classic"
  }'::jsonb,
  -- نظام التصميم
  tokens jsonb NOT NULL DEFAULT '{
    "radius_base": "0.5rem",
    "spacing_unit": "0.25rem",
    "shadow_intensity": "soft"
  }'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active theme" ON public.site_themes
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admins manage themes" ON public.site_themes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER site_themes_touch BEFORE UPDATE ON public.site_themes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- صفحات
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  title_en text,
  meta_description text,
  is_published boolean NOT NULL DEFAULT true,
  is_landing boolean NOT NULL DEFAULT false,
  layout text NOT NULL DEFAULT 'classic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published pages" ON public.site_pages
  FOR SELECT TO anon, authenticated
  USING (is_published = true OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admins manage pages" ON public.site_pages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER site_pages_touch BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- أقسام
CREATE TABLE public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.site_pages(id) ON DELETE CASCADE,
  section_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read visible sections" ON public.site_sections
  FOR SELECT TO anon, authenticated
  USING (
    (is_visible = true 
      AND (starts_at IS NULL OR starts_at <= now()) 
      AND (ends_at IS NULL OR ends_at >= now()))
    OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
  );
CREATE POLICY "Admins manage sections" ON public.site_sections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER site_sections_touch BEFORE UPDATE ON public.site_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_site_sections_page ON public.site_sections(page_id, display_order);

-- إصدارات
CREATE TABLE public.site_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'theme' | 'page' | 'section'
  entity_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  note text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read revisions" ON public.site_revisions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admins insert revisions" ON public.site_revisions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE INDEX idx_site_revisions_entity ON public.site_revisions(entity_type, entity_id, created_at DESC);

-- ثيم افتراضي وصفحة رئيسية
INSERT INTO public.site_themes (name, is_active) VALUES ('Default', true);
INSERT INTO public.site_pages (slug, title_ar, title_en, is_landing) VALUES ('home', 'الرئيسية', 'Home', false);
