
ALTER FUNCTION public.products_search_vector_update() SET search_path = public;
ALTER FUNCTION public.search_autocomplete(text, int) SET search_path = public;
ALTER FUNCTION public.search_spell_suggest(text) SET search_path = public;
ALTER FUNCTION public.increment_product_views(uuid) SET search_path = public;
