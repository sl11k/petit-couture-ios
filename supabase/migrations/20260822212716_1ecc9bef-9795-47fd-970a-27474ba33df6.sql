UPDATE public.abandoned_carts ac
SET converted = false, reached_checkout = true, stage = 'payment'
FROM public.orders o
WHERE ac.session_id = 'order-' || o.id::text
  AND COALESCE(o.payment_status, 'unpaid') NOT IN ('paid', 'captured', 'succeeded', 'refunded', 'partially_refunded');

UPDATE public.abandoned_carts ac
SET converted = true
FROM public.orders o
WHERE ac.session_id = 'order-' || o.id::text
  AND o.payment_status IN ('paid', 'captured', 'succeeded', 'refunded', 'partially_refunded');