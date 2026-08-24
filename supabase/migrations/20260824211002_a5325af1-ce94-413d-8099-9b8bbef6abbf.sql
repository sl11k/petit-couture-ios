CREATE OR REPLACE FUNCTION public.shipments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE p jsonb; o RECORD; code text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    code := 'shipment_created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    code := CASE NEW.status
      WHEN 'picked_up' THEN 'picked_up'
      WHEN 'in_transit' THEN 'in_transit'
      WHEN 'out_for_delivery' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'failed' THEN 'delivery_attempted'
      WHEN 'returned' THEN 'returned_to_sender'
      ELSE NULL END;
  END IF;
  IF code IS NULL THEN RETURN NEW; END IF;

  SELECT user_id, order_number, customer_name, customer_phone, customer_email, tracking_token
    INTO o FROM public.orders WHERE id = NEW.order_id;

  p := jsonb_build_object(
    'shipment_id', NEW.id, 'order_id', NEW.order_id, 'order_number', o.order_number,
    'customer_name', COALESCE(o.customer_name,''),
    'tracking_number', COALESCE(NEW.tracking_number,'—'),
    'carrier_tracking_url', COALESCE(NEW.tracking_url,''),
    'tracking_link', 'https://lppme.com/track/' || COALESCE(o.tracking_token,''),
    'carrier', NEW.carrier_code, 'status', NEW.status,
    'status_label', public.tracking_status_label(NEW.status,'ar'),
    'status_label_en', public.tracking_status_label(NEW.status,'en')
  );

  PERFORM public.enqueue_notification(code, 'customer', p, 'shipment', NEW.id::text,
    o.user_id, o.customer_phone, o.customer_email);

  IF code IN ('delivery_attempted','returned_to_sender') THEN
    PERFORM public.enqueue_notification('admin_shipment_failed', 'admin', p, 'shipment', NEW.id::text);
  END IF;
  RETURN NEW;
END; $function$;

-- append the live tracking link to existing shipping templates that lack it
UPDATE public.notification_templates
SET body = body || CASE WHEN language = 'en'
    THEN E'\nTracking number: {{tracking_number}}\nLive tracking: {{tracking_link}}'
    ELSE E'\nرقم التتبع: {{tracking_number}}\nرابط التتبع المباشر: {{tracking_link}}' END
WHERE audience = 'customer'
  AND channel IN ('whatsapp','sms')
  AND event_code IN ('shipment_created','picked_up','in_transit','out_for_delivery','delivered','order_shipped','order_delivered','delivery_attempted','returned_to_sender')
  AND body NOT LIKE '%tracking_link%';

UPDATE public.notification_templates
SET body = body || CASE WHEN language = 'en'
    THEN '<br/>Tracking number: {{tracking_number}}<br/><a href="{{tracking_link}}">Track your order live</a>'
    ELSE '<br/>رقم التتبع: {{tracking_number}}<br/><a href="{{tracking_link}}">تتبع شحنتك مباشرة</a>' END
WHERE audience = 'customer'
  AND channel = 'email'
  AND event_code IN ('shipment_created','picked_up','in_transit','out_for_delivery','delivered','order_shipped','order_delivered','delivery_attempted','returned_to_sender')
  AND body NOT LIKE '%tracking_link%';