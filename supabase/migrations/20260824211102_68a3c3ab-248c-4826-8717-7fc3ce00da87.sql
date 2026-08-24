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
         shipping_carrier, total, currency, created_at, customer_name, shipping_address
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
           'name', oi.product_name, 'qty', oi.qty, 'image', oi.image_url)), '[]'::jsonb)
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
    'estimated_delivery_at', s.estimated_delivery_at,
    'last_polled_at', s.last_polled_at,
    'shipment_id', s.id,
    'events', ev,
    'items', items
  );
END; $$;