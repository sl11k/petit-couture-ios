CREATE OR REPLACE FUNCTION public.get_store_analytics_data_v1(since timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  res jsonb;
  orders_data jsonb;
  items_data jsonb;
  customers_count bigint;
  sessions_count bigint;
  carts_data jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'total', total,
      'refunded_amount', refunded_amount,
      'status', status,
      'payment_status', payment_status,
      'payment_method', payment_method,
      'created_at', created_at
    )
  ), '[]'::jsonb) INTO orders_data
  FROM public.orders
  WHERE created_at >= since;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'product_name', i.product_name,
      'product_id', i.product_id,
      'name_ar', p.name_ar,
      'name_en', p.name_en,
      'qty', i.qty
    )
  ), '[]'::jsonb) INTO items_data
  FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  LEFT JOIN public.products p ON p.id = i.product_id
  WHERE o.created_at >= since AND o.payment_status = 'paid';

  SELECT count(*) INTO customers_count
  FROM public.profiles
  WHERE created_at >= since;

  SELECT count(DISTINCT session_id) INTO sessions_count
  FROM public.analytics_events
  WHERE created_at >= since AND session_id IS NOT NULL
    AND (referrer IS NULL OR (
         referrer NOT ILIKE '%lovable.dev'
         AND referrer NOT ILIKE '%lovableproject.com'
         AND referrer NOT ILIKE '%lovable.app'));

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'email', email,
      'phone', phone,
      'stage', stage,
      'subtotal', subtotal,
      'updated_at', updated_at,
      'converted', converted,
      'reached_checkout', reached_checkout,
      'abandonment_reason', abandonment_reason
    )
  ), '[]'::jsonb) INTO carts_data
  FROM public.abandoned_carts
  WHERE updated_at >= since;

  res := jsonb_build_object(
    'orders', orders_data,
    'items', items_data,
    'customers_count', customers_count,
    'sessions_count', sessions_count,
    'carts', carts_data
  );

  RETURN res;
END;
$function$;