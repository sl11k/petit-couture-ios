-- ============= Extend products table =============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS short_description_ar text,
  ADD COLUMN IF NOT EXISTS short_description_en text,
  ADD COLUMN IF NOT EXISTS cost numeric,
  ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS dimensions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sale_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS allow_preorder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_when_out_of_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deduct_on text NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS image_alt text,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON public.products (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products (status);
CREATE INDEX IF NOT EXISTS products_publish_at_idx ON public.products (publish_at);

-- ============= Variants =============
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  barcode text,
  color text,
  size text,
  volume text,
  flavor text,
  material text,
  price numeric,
  compare_at_price numeric,
  cost numeric,
  stock integer NOT NULL DEFAULT 0,
  weight numeric,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_unique ON public.product_variants (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants (product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read variants of active products"
  ON public.product_variants FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins manage variants"
  ON public.product_variants FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER touch_variants_updated BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= Marketing relations =============
CREATE TABLE IF NOT EXISTS public.product_relations (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, related_product_id, relation_type)
);
CREATE INDEX IF NOT EXISTS product_relations_product_idx ON public.product_relations (product_id, relation_type);

ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read relations"
  ON public.product_relations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage relations"
  ON public.product_relations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- ============= Bundles & Quantity offers =============
CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  offer_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_offers_product_idx ON public.product_offers (product_id);

ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active offers"
  ON public.product_offers FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins manage offers"
  ON public.product_offers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER touch_offers_updated BEFORE UPDATE ON public.product_offers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= Storage bucket for product images =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- ============= sales_count derived from order_items (best-effort, refreshable) =============
CREATE OR REPLACE FUNCTION public.refresh_product_sales_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
  SET sales_count = COALESCE(s.total_qty, 0)
  FROM (
    SELECT product_id, SUM(qty) AS total_qty
    FROM public.order_items
    WHERE product_id IS NOT NULL
    GROUP BY product_id
  ) s
  WHERE p.id = s.product_id;
END;
$$;