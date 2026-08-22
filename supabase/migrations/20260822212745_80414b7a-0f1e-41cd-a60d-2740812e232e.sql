ALTER FUNCTION public.sync_order_cart_conversion() NO DEPENDS ON EXTENSION plpgsql;
REVOKE EXECUTE ON FUNCTION public.sync_order_cart_conversion() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_order_cart_conversion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_order_cart_conversion() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_cart_conversion() TO postgres, service_role;