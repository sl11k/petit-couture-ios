ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS materials_ar text,
  ADD COLUMN IF NOT EXISTS materials_en text,
  ADD COLUMN IF NOT EXISTS care_ar text,
  ADD COLUMN IF NOT EXISTS care_en text;