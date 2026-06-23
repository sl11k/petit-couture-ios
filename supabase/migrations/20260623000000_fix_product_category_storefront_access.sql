-- The admin product form stores multi-category assignments here, so the
-- public storefront must be able to read the same junction table.
GRANT SELECT ON TABLE public.product_categories TO anon, authenticated;

DROP POLICY IF EXISTS "Public read product_categories" ON public.product_categories;
CREATE POLICY "Public read product_categories"
  ON public.product_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Keep the former junction table readable while legacy assignments are
-- migrated/consumed by older sections.
GRANT SELECT ON TABLE public.category_products TO anon, authenticated;

DROP POLICY IF EXISTS "Public read category_products" ON public.category_products;
CREATE POLICY "Public read category_products"
  ON public.category_products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Preserve every historical assignment in the canonical admin table.
INSERT INTO public.product_categories (product_id, category_id, is_primary)
SELECT cp.product_id, cp.category_id, false
FROM public.category_products cp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_categories pc
  WHERE pc.product_id = cp.product_id AND pc.category_id = cp.category_id
);

INSERT INTO public.product_categories (product_id, category_id, is_primary)
SELECT p.id, p.category_id, true
FROM public.products p
WHERE p.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_categories pc
    WHERE pc.product_id = p.id AND pc.category_id = p.category_id
  );

UPDATE public.product_categories pc
SET is_primary = true
FROM public.products p
WHERE p.category_id IS NOT NULL
  AND pc.product_id = p.id
  AND pc.category_id = p.category_id;
