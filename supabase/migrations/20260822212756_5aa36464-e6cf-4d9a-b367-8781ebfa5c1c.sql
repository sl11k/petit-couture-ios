ALTER FUNCTION public.sync_order_cart_conversion() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.sync_order_cart_conversion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_cart_conversion() TO postgres, service_role;