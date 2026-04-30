
-- Extend landing_pages with sort/display options + position
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_mode text NOT NULL DEFAULT 'manual' CHECK (sort_mode IN ('manual','newest','best_sellers','price_asc','price_desc')),
  ADD COLUMN IF NOT EXISTS show_as_collection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_landing_pages_collection_active
  ON public.landing_pages (show_as_collection, is_active, position);
