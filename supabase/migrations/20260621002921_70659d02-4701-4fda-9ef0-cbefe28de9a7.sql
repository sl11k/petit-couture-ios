ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS custom_css text DEFAULT '';
ALTER TABLE public.cms_pages ADD COLUMN IF NOT EXISTS ab_test_id uuid REFERENCES public.ab_tests(id) ON DELETE SET NULL;
GRANT SELECT ON public.ab_tests TO anon;