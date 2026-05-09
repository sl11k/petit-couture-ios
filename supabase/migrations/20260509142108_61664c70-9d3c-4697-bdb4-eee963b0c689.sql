CREATE OR REPLACE FUNCTION public.orders_emit_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _payload jsonb;
BEGIN
  _payload := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', NEW.order_number,
    'status', NEW.status,
    'payment_status', NEW.payment_status,
    'total', NEW.total,
    'currency', NEW.currency,
    'customer_id', NEW.user_id,
    'created_at', NEW.created_at
  );
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_webhook_event('order.created', _payload);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      PERFORM public.emit_webhook_event('order.paid', _payload);
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'cancelled' THEN
        PERFORM public.emit_webhook_event('order.cancelled', _payload);
      ELSIF NEW.status = 'shipped' THEN
        PERFORM public.emit_webhook_event('order.shipped', _payload);
      ELSIF NEW.status = 'delivered' THEN
        PERFORM public.emit_webhook_event('order.delivered', _payload);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;