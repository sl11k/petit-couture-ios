ALTER FUNCTION public.sync_order_cart_conversion() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.sync_order_cart_conversion() FROM PUBLIC, anon, authenticated, service_role;