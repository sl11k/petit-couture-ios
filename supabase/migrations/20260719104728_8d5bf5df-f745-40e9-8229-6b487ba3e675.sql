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
    -- Only confirmed-at-placement methods are real new orders at insert time.
    -- Hosted/deferred payment attempts must not notify admin/customer until paid.
    IF COALESCE(NEW.payment_status, '') IN ('paid', 'captured', 'authorized')
       OR NEW.payment_method::text IN ('cod', 'bank_transfer') THEN
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

CREATE OR REPLACE FUNCTION public.webhook_events_to_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p jsonb := NEW.payload;
  et text := NEW.event_type;
  cust_id uuid := NULLIF(p->>'customer_id','')::uuid;
  order_id text := p->>'order_id';
  cust_email text := COALESCE(p->>'customer_email', p->>'email');
  cust_phone text := p->>'customer_phone';
BEGIN
  IF et = 'order.created' THEN
    -- Only confirmed-at-placement orders reach this event. Async attempts are blocked in orders_emit_events().
    PERFORM public.enqueue_notification('order_created', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('admin_new_order', 'admin', p, 'order', order_id);
  ELSIF et = 'order.paid' THEN
    -- Payment-confirmed order: customer gets paid confirmation, admin gets the real new-order alert.
    PERFORM public.enqueue_notification('order_paid', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('payment_received', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('admin_new_order', 'admin', p, 'order', order_id);
  ELSIF et = 'order.shipped' THEN
    PERFORM public.enqueue_notification('order_shipped', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
  ELSIF et = 'order.delivered' THEN
    PERFORM public.enqueue_notification('order_delivered', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('order_completed', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
  ELSIF et = 'order.cancelled' THEN
    IF COALESCE(p->>'payment_status', '') <> 'unpaid' THEN
      PERFORM public.enqueue_notification('order_cancelled_by_admin', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    END IF;
  ELSIF et = 'customer.created' THEN
    PERFORM public.enqueue_notification('welcome', 'customer', p, 'customer', cust_id::text, cust_id, NULL, cust_email);
    PERFORM public.enqueue_notification('admin_new_customer', 'admin', p, 'customer', cust_id::text);
  ELSIF et = 'inventory.low' THEN
    PERFORM public.enqueue_notification('admin_low_stock', 'admin', p, 'product', p->>'product_id');
    IF (p->>'stock')::int = 0 THEN
      PERFORM public.enqueue_notification('admin_out_of_stock', 'admin', p, 'product', p->>'product_id');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the modern queue processor has enabled templates for payment-confirmed messages.
UPDATE public.notif_templates
SET is_enabled = true, updated_at = now()
WHERE event_code = 'order.paid'
  AND channel = 'whatsapp'
  AND audience IN ('admin', 'customer');