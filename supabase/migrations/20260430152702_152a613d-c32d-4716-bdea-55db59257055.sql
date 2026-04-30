
CREATE TABLE IF NOT EXISTS public.home_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'hero','banners','featured_categories','most_popular',
    'new_arrivals','custom_collection','announcements','rich_text'
  )),
  title_ar text,
  title_en text,
  eyebrow_ar text,
  eyebrow_en text,
  -- For product-based sections: where products come from
  data_source text NOT NULL DEFAULT 'auto'
    CHECK (data_source IN ('auto','best_sellers','newest','category','collection','manual')),
  -- Used when data_source = 'category' (categories.slug) or 'collection' (landing_pages.id)
  source_ref text,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  -- Display knobs (limit, columns, layout flavor)
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_sections_active_position
  ON public.home_sections (is_active, position);

ALTER TABLE public.home_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active home sections"
  ON public.home_sections FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage home sections"
  ON public.home_sections FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'storefront.manage')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_permission(auth.uid(),'storefront.manage')
  );

CREATE TRIGGER home_sections_updated
  BEFORE UPDATE ON public.home_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
