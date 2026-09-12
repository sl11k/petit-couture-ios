-- Expired hosted checkout sessions are customer abandonment, not gateway
-- failures. Reclassify historical rows without touching successful payments.
UPDATE public.payment_transactions
SET status = 'expired',
    failed_at = NULL,
    updated_at = now()
WHERE status = 'failed'
  AND error_message IN (
    'checkout.session.expired',
    'tabby_expired',
    'tamara_order_expired'
  );

UPDATE public.orders AS o
SET payment_status = 'expired',
    updated_at = now()
WHERE o.payment_status = 'failed'
  AND o.payment_failure_reason IN (
    'checkout.session.expired',
    'tabby_expired',
    'tamara_order_expired'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_transactions AS pt
    WHERE pt.order_id = o.id
      AND pt.status IN ('captured', 'paid')
  );
