ALTER TABLE public.storefront_settings
ADD COLUMN IF NOT EXISTS banner_display_mode text NOT NULL DEFAULT 'rotate';

ALTER TABLE public.storefront_settings
DROP CONSTRAINT IF EXISTS storefront_settings_banner_display_mode_check;

ALTER TABLE public.storefront_settings
ADD CONSTRAINT storefront_settings_banner_display_mode_check
CHECK (banner_display_mode IN ('rotate','slider'));