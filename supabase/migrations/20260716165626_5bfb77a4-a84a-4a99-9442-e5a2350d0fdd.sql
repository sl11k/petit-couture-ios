
CREATE OR REPLACE FUNCTION public.trg_orders_release_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  should_release boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('cancelled', 'refunded', 'expired') THEN
    should_release := true;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status::text IN ('refunded', 'failed', 'expired') THEN
    should_release := true;
  END IF;

  IF should_release AND NEW.stock_reserved_at IS NOT NULL THEN
    PERFORM public.release_order_inventory(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_release_stock ON public.orders;
CREATE TRIGGER trg_orders_release_stock
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_release_stock();
