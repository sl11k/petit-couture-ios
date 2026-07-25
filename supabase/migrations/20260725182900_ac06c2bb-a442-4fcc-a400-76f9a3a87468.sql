GRANT SELECT, INSERT, UPDATE ON public.abandoned_carts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;