CREATE OR REPLACE FUNCTION public.abandoned_carts_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE p jsonb;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP='UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage AND NEW.stage='abandoned') THEN
    p := jsonb_build_object('cart_id', NEW.id, 'subtotal', NEW.subtotal, 'items', NEW.items);
    PERFORM public.enqueue_notification('cart_abandoned_1h', 'customer', p, 'abandoned_cart', NEW.id::text, NEW.user_id, NEW.phone, NEW.email);
    IF NEW.subtotal IS NOT NULL AND NEW.subtotal >= 500 THEN
      PERFORM public.enqueue_notification('admin_abandoned_cart_high_value', 'admin', p, 'abandoned_cart', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;