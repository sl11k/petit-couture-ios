ALTER TABLE public.reviews ALTER COLUMN images SET DEFAULT '[]'::jsonb;
UPDATE public.reviews SET images = '[]'::jsonb WHERE images IS NULL;