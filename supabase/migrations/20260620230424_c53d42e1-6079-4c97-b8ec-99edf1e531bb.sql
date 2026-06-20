
ALTER TABLE public.product_relations
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS title_en text;

GRANT SELECT ON public.product_relations TO anon;
