CREATE OR REPLACE FUNCTION public.orders_notify_tracking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eff text; old_eff text; p jsonb; link text;
BEGIN
  IF COALESCE(NEW.payment_status,'') NOT IN ('paid','captured','partially_refunded','refunded') THEN
    RETURN NEW;
  END IF;

  eff := COALESCE(NULLIF(NEW.shipping_status,''), NEW.status::text);
  old_eff := COALESCE(NULLIF(OLD.shipping_status,''), OLD.status::text);

  IF eff IS NOT DISTINCT FROM old_eff
     AND COALESCE(NEW.tracking_number,'') = COALESCE(OLD.tracking_number,'') THEN
    RETURN NEW;
  END IF;
  IF eff IS NULL OR eff = '' THEN RETURN NEW; END IF;

  link := 'https://lppme.com/track/' || COALESCE(NEW.tracking_token, '');

  p := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', NEW.order_number,
    'customer_name', COALESCE(NEW.customer_name,''),
    'status', eff,
    'status_label', public.tracking_status_label(eff,'ar'),
    'status_label_en', public.tracking_status_label(eff,'en'),
    'tracking_number', COALESCE(NEW.tracking_number, '—'),
    'carrier_tracking_url', COALESCE(NEW.tracking_url,''),
    'tracking_link', link
  );

  PERFORM public.enqueue_notification(
    'order_tracking_update', 'customer', p, 'order', NEW.id::text,
    NEW.user_id, NEW.customer_phone, NEW.customer_email, 'ar'
  );
  RETURN NEW;
END;
$$;