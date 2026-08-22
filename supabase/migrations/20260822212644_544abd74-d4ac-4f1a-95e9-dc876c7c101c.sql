REVOKE ALL ON FUNCTION public.sync_order_cart_conversion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_cart_conversion() TO service_role;