
ALTER TABLE public.season_picks ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.season_picks ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.season_picks ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE public.season_picks ADD COLUMN IF NOT EXISTS label_ar text;
ALTER TABLE public.season_picks ADD COLUMN IF NOT EXISTS label_en text;
ALTER TABLE public.season_picks DROP CONSTRAINT IF EXISTS season_picks_target_check;
ALTER TABLE public.season_picks ADD CONSTRAINT season_picks_target_check
  CHECK (product_id IS NOT NULL OR (image_url IS NOT NULL AND link_url IS NOT NULL));
