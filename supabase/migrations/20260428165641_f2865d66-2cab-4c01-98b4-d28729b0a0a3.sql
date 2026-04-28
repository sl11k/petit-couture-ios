
REVOKE EXECUTE ON FUNCTION public.release_expired_order_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_expired_orders() FROM PUBLIC, anon, authenticated;
