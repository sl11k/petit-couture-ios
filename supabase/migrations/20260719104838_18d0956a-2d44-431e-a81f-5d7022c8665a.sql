CREATE OR REPLACE FUNCTION public.orders_emit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payload jsonb;
BEGIN
  _payload := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', NEW.order_number,
    'status', NEW.status,
    'payment_status', NEW.payment_status,
    'payment_method', NEW.payment_method,
    'total', NEW.total,
    'currency', NEW.currency,
    'customer_id', NEW.user_id,
    'customer_name', NEW.customer_name,
    'customer_phone', NEW.customer_phone,
    'customer_email', NEW.customer_email,
    'created_at', NEW.created_at
  );

  IF TG_OP = 'INSERT' THEN
    -- Creating an order row is not a real order notification unless payment is already verified.
    IF COALESCE(NEW.payment_status, '') IN ('paid', 'captured') THEN
      PERFORM public.emit_webhook_event('order.created', _payload);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      PERFORM public.emit_webhook_event('order.paid', _payload);
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'cancelled' AND COALESCE(NEW.payment_status, '') <> 'unpaid' THEN
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
$$;

DELETE FROM public.notif_queue q
USING public.orders o
WHERE q.related_entity = 'order'
  AND q.related_entity_id = o.id::text
  AND COALESCE(o.payment_status, '') NOT IN ('paid', 'partially_refunded', 'refunded')
  AND q.status IN ('pending', 'retry', 'processing')
  AND q.event_code IN ('order.created', 'order_created', 'admin_new_order', 'order.paid', 'order_paid', 'payment_received');

DELETE FROM public.admin_notifications n
USING public.orders o
WHERE n.related_entity = 'order'
  AND n.related_entity_id = o.id::text
  AND COALESCE(o.payment_status, '') NOT IN ('paid', 'partially_refunded', 'refunded')
  AND n.event_code IN ('order.created', 'order_created', 'admin_new_order', 'order.paid', 'order_paid', 'payment_received');