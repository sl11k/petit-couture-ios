DROP TRIGGER IF EXISTS trg_sync_order_cart_conversion ON public.orders;
CREATE TRIGGER trg_sync_order_cart_conversion
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_cart_conversion();