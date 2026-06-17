
-- =========== cms_pages ===========
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'custom' CHECK (type IN ('home','about','contact','custom','landing')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  draft_content jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  published_content jsonb,
  seo_title_ar text,
  seo_title_en text,
  seo_description_ar text,
  seo_description_en text,
  og_image_url text,
  noindex boolean NOT NULL DEFAULT false,
  canonical_url text,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

GRANT SELECT ON public.cms_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_pages TO authenticated;
GRANT ALL ON public.cms_pages TO service_role;

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

-- Public can read only published pages
CREATE POLICY "cms_pages public read published"
  ON public.cms_pages FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Admins/content managers can read all
CREATE POLICY "cms_pages admin read all"
  ON public.cms_pages FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'content_manager')
  );

CREATE POLICY "cms_pages admin write"
  ON public.cms_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'content_manager')
  );

CREATE POLICY "cms_pages admin update"
  ON public.cms_pages FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'content_manager')
  );

CREATE POLICY "cms_pages admin delete"
  ON public.cms_pages FOR DELETE
  TO authenticated
  USING (
    (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
    AND is_system = false
  );

CREATE TRIGGER cms_pages_updated_at
  BEFORE UPDATE ON public.cms_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS cms_pages_slug_idx ON public.cms_pages(slug);
CREATE INDEX IF NOT EXISTS cms_pages_status_idx ON public.cms_pages(status);

-- =========== cms_page_versions ===========
CREATE TABLE IF NOT EXISTS public.cms_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  content jsonb NOT NULL,
  version_label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.cms_page_versions TO authenticated;
GRANT ALL ON public.cms_page_versions TO service_role;

ALTER TABLE public.cms_page_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cms_page_versions admin read"
  ON public.cms_page_versions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'content_manager')
  );

CREATE POLICY "cms_page_versions admin write"
  ON public.cms_page_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'content_manager')
  );

CREATE POLICY "cms_page_versions admin delete"
  ON public.cms_page_versions FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
  );

CREATE INDEX IF NOT EXISTS cms_page_versions_page_idx ON public.cms_page_versions(page_id, created_at DESC);

-- =========== Seed: home page (legacy fallback) ===========
INSERT INTO public.cms_pages (slug, title_ar, title_en, type, status, is_system, draft_content, published_content, published_at)
VALUES (
  'home',
  'الرئيسية',
  'Home',
  'home',
  'published',
  true,
  '{"sections":[{"id":"legacy-home-1","type":"legacy_home","content":{},"settings":{}}]}'::jsonb,
  '{"sections":[{"id":"legacy-home-1","type":"legacy_home","content":{},"settings":{}}]}'::jsonb,
  now()
)
ON CONFLICT (slug) DO NOTHING;
