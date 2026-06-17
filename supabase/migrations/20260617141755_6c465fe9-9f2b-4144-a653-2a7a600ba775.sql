ALTER TABLE public.home_sections ALTER COLUMN config SET DEFAULT '{}'::jsonb;
UPDATE public.home_sections SET config = '{}'::jsonb WHERE config IS NULL;