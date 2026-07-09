ALTER TABLE public.storefront_banners
  ADD COLUMN IF NOT EXISTS image_url_tablet text,
  ADD COLUMN IF NOT EXISTS image_url_desktop text,
  ADD COLUMN IF NOT EXISTS object_position text NOT NULL DEFAULT 'center center',
  ADD COLUMN IF NOT EXISTS object_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS height_mobile integer,
  ADD COLUMN IF NOT EXISTS height_tablet integer,
  ADD COLUMN IF NOT EXISTS height_desktop integer,
  ADD COLUMN IF NOT EXISTS overlay_opacity numeric;