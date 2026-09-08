CREATE OR REPLACE FUNCTION public.sync_order_cart_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status IN ('paid', 'captured', 'succeeded', 'refunded', 'partially_refunded') THEN
    UPDATE public.abandoned_carts
       SET converted = true,
           updated_at = now()
     WHERE session_id = 'order-' || NEW.id::text;
  ELSIF NEW.payment_status IN ('unpaid', 'pending', 'failed', 'expired') THEN
    INSERT INTO public.abandoned_carts AS ac (
      session_id, user_id, email, phone, items, subtotal, currency,
      reached_checkout, converted, stage, source, created_at, updated_at
    )
    SELECT
      'order-' || NEW.id::text,
      NEW.user_id,
      NEW.customer_email,
      NEW.customer_phone,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'variantId', oi.variant_id,
          'name', oi.product_name,
          'image', null,
          'price', oi.unit_price,
          'qty', oi.qty,
          'size', oi.size,
          'color', oi.color,
          'sku', oi.sku,
          'currency', NEW.currency
        ) ORDER BY oi.created_at)
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
      ), '[]'::jsonb),
      NEW.total,
      NEW.currency,
      true,
      false,
      'payment',
      COALESCE(NEW.payment_method::text, 'checkout'),
      NEW.created_at,
      COALESCE(NEW.updated_at, now())
    ON CONFLICT (session_id) DO UPDATE SET
      user_id = COALESCE(EXCLUDED.user_id, ac.user_id),
      email = COALESCE(EXCLUDED.email, ac.email),
      phone = COALESCE(EXCLUDED.phone, ac.phone),
      items = CASE WHEN jsonb_array_length(EXCLUDED.items) > 0 THEN EXCLUDED.items ELSE ac.items END,
      subtotal = EXCLUDED.subtotal,
      currency = EXCLUDED.currency,
      reached_checkout = true,
      converted = false,
      stage = 'payment',
      source = EXCLUDED.source,
      updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_cart_conversion() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_cart_conversion() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_order_cart_conversion ON public.orders;
CREATE TRIGGER trg_sync_order_cart_conversion
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION public.sync_order_cart_conversion();

INSERT INTO public.abandoned_carts AS ac (
  session_id, user_id, email, phone, items, subtotal, currency,
  reached_checkout, converted, stage, source, created_at, updated_at
)
SELECT
  'order-' || o.id::text,
  o.user_id,
  o.customer_email,
  o.customer_phone,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'variantId', oi.variant_id,
      'name', oi.product_name,
      'image', null,
      'price', oi.unit_price,
      'qty', oi.qty,
      'size', oi.size,
      'color', oi.color,
      'sku', oi.sku,
      'currency', o.currency
    ) ORDER BY oi.created_at)
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ), '[]'::jsonb),
  o.total,
  o.currency,
  true,
  false,
  'payment',
  COALESCE(o.payment_method::text, 'checkout'),
  o.created_at,
  COALESCE(o.updated_at, o.created_at)
FROM public.orders o
WHERE COALESCE(o.payment_status, 'unpaid') NOT IN ('paid', 'captured', 'succeeded', 'refunded', 'partially_refunded')
ON CONFLICT (session_id) DO UPDATE SET
  user_id = COALESCE(EXCLUDED.user_id, ac.user_id),
  email = COALESCE(EXCLUDED.email, ac.email),
  phone = COALESCE(EXCLUDED.phone, ac.phone),
  items = CASE WHEN jsonb_array_length(EXCLUDED.items) > 0 THEN EXCLUDED.items ELSE ac.items END,
  subtotal = EXCLUDED.subtotal,
  currency = EXCLUDED.currency,
  reached_checkout = true,
  converted = false,
  stage = 'payment',
  source = EXCLUDED.source,
  updated_at = EXCLUDED.updated_at;

UPDATE public.abandoned_carts ac
SET converted = true, updated_at = now()
FROM public.orders o
WHERE 'order-' || o.id::text = ac.session_id
  AND o.payment_status IN ('paid', 'captured', 'succeeded', 'refunded', 'partially_refunded');