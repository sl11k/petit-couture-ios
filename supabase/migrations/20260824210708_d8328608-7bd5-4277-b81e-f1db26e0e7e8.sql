-- 1) tracking token on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_token text;
UPDATE public.orders SET tracking_token = encode(gen_random_bytes(9),'hex') WHERE tracking_token IS NULL;
ALTER TABLE public.orders ALTER COLUMN tracking_token SET DEFAULT encode(gen_random_bytes(9),'hex');
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_idx ON public.orders(tracking_token);

-- 2) public tracking reader (token-gated, security definer)
CREATE OR REPLACE FUNCTION public.get_order_tracking(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE o RECORD; s RECORD; ev jsonb; items jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT id, order_number, status, payment_status, shipping_status, tracking_number, tracking_url,
         shipping_carrier, total, currency, created_at, customer_name, shipping_address, estimated_delivery
    INTO o FROM public.orders WHERE tracking_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id, status, tracking_number, tracking_url, carrier_code, city, shipped_at, delivered_at,
         estimated_delivery_at, last_polled_at
    INTO s FROM public.shipments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'status', e.status, 'description', e.description, 'location', e.location,
           'occurred_at', e.occurred_at) ORDER BY e.occurred_at DESC), '[]'::jsonb)
    INTO ev FROM public.shipment_tracking_events e WHERE e.shipment_id = s.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', oi.product_name, 'qty', oi.quantity, 'image', oi.product_image)), '[]'::jsonb)
    INTO items FROM public.order_items oi WHERE oi.order_id = o.id;

  RETURN jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'shipping_status', COALESCE(s.status, o.shipping_status),
    'tracking_number', COALESCE(s.tracking_number, o.tracking_number),
    'carrier_tracking_url', COALESCE(s.tracking_url, o.tracking_url),
    'carrier', COALESCE(s.carrier_code, o.shipping_carrier),
    'total', o.total, 'currency', o.currency,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'city', COALESCE(s.city, o.shipping_address->>'city'),
    'shipped_at', s.shipped_at,
    'delivered_at', s.delivered_at,
    'estimated_delivery_at', COALESCE(s.estimated_delivery_at, o.estimated_delivery),
    'last_polled_at', s.last_polled_at,
    'shipment_id', s.id,
    'events', ev,
    'items', items
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking(text) TO anon, authenticated, service_role;

-- 3) notification rule + templates for tracking updates
INSERT INTO public.notification_rules (event_code, audience, channels, is_enabled, trigger_mode, delay_minutes)
SELECT 'order_tracking_update', 'customer', '["whatsapp","email"]'::jsonb, true, 'auto', 0
WHERE NOT EXISTS (SELECT 1 FROM public.notification_rules WHERE event_code='order_tracking_update' AND audience='customer');

INSERT INTO public.notification_templates (template_key, event_code, audience, channel, language, subject, body, is_enabled)
SELECT v.event_code||'.'||v.audience||'.'||v.channel||'.'||v.language, v.event_code, v.audience, v.channel, v.language, v.subject, v.body, true
FROM (VALUES
 ('order_tracking_update','customer','whatsapp','ar', 'تحديث طلبك',
  E'مرحباً {{customer_name}} 👋\nتم تحديث حالة طلبك رقم *{{order_number}}*\nالحالة الحالية: {{status_label}}\nرقم التتبع: {{tracking_number}}\nرابط التتبع المباشر: {{tracking_link}}'),
 ('order_tracking_update','customer','whatsapp','en', 'Order update',
  E'Hi {{customer_name}} 👋\nYour order *{{order_number}}* has been updated.\nCurrent status: {{status_label_en}}\nTracking number: {{tracking_number}}\nLive tracking: {{tracking_link}}'),
 ('order_tracking_update','customer','email','ar', 'تحديث حالة طلبك {{order_number}}',
  E'مرحباً {{customer_name}}،<br/>تم تحديث حالة طلبك رقم <b>{{order_number}}</b>.<br/>الحالة الحالية: {{status_label}}<br/>رقم التتبع: {{tracking_number}}<br/><a href="{{tracking_link}}">تتبع طلبك مباشرة</a>'),
 ('order_tracking_update','customer','email','en', 'Update on order {{order_number}}',
  E'Hi {{customer_name}},<br/>Your order <b>{{order_number}}</b> was updated.<br/>Status: {{status_label_en}}<br/>Tracking number: {{tracking_number}}<br/><a href="{{tracking_link}}">Track your order live</a>')
) AS v(event_code,audience,channel,language,subject,body)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates t
  WHERE t.event_code=v.event_code AND t.audience=v.audience AND t.channel=v.channel AND t.language=v.language
);

-- 4) status label helper
CREATE OR REPLACE FUNCTION public.tracking_status_label(_status text, _lang text DEFAULT 'ar')
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE lower(COALESCE(_status,''))
    WHEN 'pending' THEN CASE WHEN _lang='en' THEN 'Pending' ELSE 'قيد المراجعة' END
    WHEN 'confirmed' THEN CASE WHEN _lang='en' THEN 'Confirmed' ELSE 'تم تأكيد الطلب' END
    WHEN 'processing' THEN CASE WHEN _lang='en' THEN 'Processing' ELSE 'قيد التجهيز' END
    WHEN 'ready_to_ship' THEN CASE WHEN _lang='en' THEN 'Ready to ship' ELSE 'جاهز للشحن' END
    WHEN 'picked_up' THEN CASE WHEN _lang='en' THEN 'Picked up' ELSE 'استلمتها شركة الشحن' END
    WHEN 'shipped' THEN CASE WHEN _lang='en' THEN 'Shipped' ELSE 'تم شحن الطلب' END
    WHEN 'in_transit' THEN CASE WHEN _lang='en' THEN 'In transit' ELSE 'في الطريق إليك' END
    WHEN 'out_for_delivery' THEN CASE WHEN _lang='en' THEN 'Out for delivery' ELSE 'خارج للتسليم' END
    WHEN 'delivered' THEN CASE WHEN _lang='en' THEN 'Delivered' ELSE 'تم التسليم' END
    WHEN 'returned' THEN CASE WHEN _lang='en' THEN 'Returned' ELSE 'مرتجع' END
    WHEN 'failed' THEN CASE WHEN _lang='en' THEN 'Delivery attempt failed' ELSE 'تعذر التسليم' END
    WHEN 'cancelled' THEN CASE WHEN _lang='en' THEN 'Cancelled' ELSE 'ملغي' END
    ELSE COALESCE(_status,'')
  END;
$$;

-- 5) notify customer on any order tracking-relevant change
CREATE OR REPLACE FUNCTION public.orders_notify_tracking_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  eff text; old_eff text; p jsonb; link text;
BEGIN
  -- only for orders that have actually been paid
  IF COALESCE(NEW.payment_status,'') NOT IN ('paid','captured','partially_refunded','refunded') THEN
    RETURN NEW;
  END IF;

  eff := COALESCE(NULLIF(NEW.shipping_status,''), NEW.status);
  old_eff := COALESCE(NULLIF(OLD.shipping_status,''), OLD.status);

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
END; $$;

DROP TRIGGER IF EXISTS trg_orders_notify_tracking_update ON public.orders;
CREATE TRIGGER trg_orders_notify_tracking_update
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_notify_tracking_update();

-- 6) mirror shipment status changes onto the order so the customer gets one clean message
CREATE OR REPLACE FUNCTION public.shipments_sync_order_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE mapped text;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  mapped := CASE NEW.status
    WHEN 'picked_up' THEN 'shipped'
    WHEN 'in_transit' THEN 'in_transit'
    WHEN 'out_for_delivery' THEN 'out_for_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'returned' THEN 'returned'
    WHEN 'failed' THEN 'failed'
    ELSE NULL END;

  UPDATE public.orders o SET
    shipping_status = COALESCE(mapped, o.shipping_status),
    tracking_number = COALESCE(NEW.tracking_number, o.tracking_number),
    tracking_url = COALESCE(NEW.tracking_url, o.tracking_url),
    shipping_carrier = COALESCE(NEW.carrier_code, o.shipping_carrier)
  WHERE o.id = NEW.order_id
    AND (COALESCE(mapped, o.shipping_status) IS DISTINCT FROM o.shipping_status
      OR COALESCE(NEW.tracking_number, o.tracking_number) IS DISTINCT FROM o.tracking_number
      OR COALESCE(NEW.tracking_url, o.tracking_url) IS DISTINCT FROM o.tracking_url);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_shipments_sync_order_tracking ON public.shipments;
CREATE TRIGGER trg_shipments_sync_order_tracking
AFTER INSERT OR UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.shipments_sync_order_tracking();