CREATE OR REPLACE FUNCTION public.orders_emit_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _payload jsonb;
  _total text;
BEGIN
  _total := COALESCE(NEW.total::text, '0');
  _payload := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', NEW.order_number,
    'status', NEW.status,
    'payment_status', NEW.payment_status,
    'payment_method', NEW.payment_method,
    'total', _total,
    'amount', _total,
    'order_total', _total,
    'currency', NEW.currency,
    'customer_id', NEW.user_id,
    'customer_name', NEW.customer_name,
    'customer_phone', NEW.customer_phone,
    'customer_email', NEW.customer_email,
    'created_at', NEW.created_at
  );

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.payment_status, '') IN ('paid', 'captured') THEN
      PERFORM public.emit_webhook_event('order.created', _payload);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status
       AND COALESCE(NEW.payment_status, '') IN ('paid', 'captured') THEN
      PERFORM public.emit_webhook_event('order.paid', _payload);
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Only notify about cancellation when the order was actually paid.
      -- Auto-expired / never-paid carts must NEVER message the customer.
      IF NEW.status = 'cancelled'
         AND COALESCE(OLD.payment_status, '') IN ('paid','captured','refunded','partially_refunded')
         AND COALESCE(NEW.payment_status, '') NOT IN ('expired','unpaid','failed','pending','pending_review') THEN
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