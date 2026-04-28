-- Extend categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS banner_link text,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS image_alt text,
  ADD COLUMN IF NOT EXISTS display_rules jsonb NOT NULL DEFAULT '{"sort":"manual","filters":{"price":true,"color":true,"size":true,"brand":true,"availability":true,"rating":true}}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active_order ON public.categories(is_active, display_order);

-- Manual product ordering within a category
CREATE TABLE IF NOT EXISTS public.category_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(category_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_products_cat_order ON public.category_products(category_id, display_order);

ALTER TABLE public.category_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read category_products"
  ON public.category_products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage category_products"
  ON public.category_products FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Touch trigger
DROP TRIGGER IF EXISTS trg_categories_updated ON public.categories;
CREATE TRIGGER trg_categories_updated
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
