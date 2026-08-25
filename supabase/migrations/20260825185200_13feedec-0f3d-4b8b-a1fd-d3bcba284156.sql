CREATE OR REPLACE FUNCTION public.complete_async_payment(_order_id uuid, _gateway text, _gateway_transaction_id text, _transaction_id uuid, _amount numeric, _currency text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
  tx public.payment_transactions%ROWTYPE;
  newly_finalized boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT * INTO tx FROM public.payment_transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction not found'; END IF;

  IF o.payment_method::text <> _gateway THEN RAISE EXCEPTION 'Payment method mismatch'; END IF;
  IF abs(o.total - _amount) > 0.01 THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  IF upper(o.currency) <> upper(_currency) THEN RAISE EXCEPTION 'Payment currency mismatch'; END IF;
  IF tx.order_id IS DISTINCT FROM _order_id THEN RAISE EXCEPTION 'Payment transaction order mismatch'; END IF;
  IF NOT (
    tx.gateway = _gateway
    OR (tx.gateway = 'stripe' AND _gateway IN ('stripe', 'card', 'apple_pay'))
  ) THEN RAISE EXCEPTION 'Payment transaction gateway mismatch'; END IF;
  IF tx.gateway_transaction_id IS DISTINCT FROM _gateway_transaction_id THEN RAISE EXCEPTION 'Payment transaction reference mismatch'; END IF;
  IF abs(tx.amount - _amount) > 0.01 THEN RAISE EXCEPTION 'Payment transaction amount mismatch'; END IF;
  IF upper(tx.currency) <> upper(_currency) THEN RAISE EXCEPTION 'Payment transaction currency mismatch'; END IF;

  IF o.payment_stock_finalized_at IS NULL THEN
    PERFORM public.finalize_order_stock(_order_id);
    newly_finalized := true;
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid',
         status = CASE WHEN status = 'pending' THEN 'processing'::public.order_status ELSE status END,
         payment_gateway = tx.gateway,
         last_transaction_id = _transaction_id,
         captured_amount = _amount,
         payment_failure_reason = NULL,
         payment_stock_finalized_at = COALESCE(payment_stock_finalized_at, now()),
         updated_at = now()
   WHERE id = _order_id;

  UPDATE public.payment_transactions
     SET status = 'captured',
         captured_at = COALESCE(captured_at, now()),
         webhook_verified = true,
         updated_at = now()
   WHERE id = _transaction_id;

  PERFORM public.record_order_coupon_redemption(_order_id);
  RETURN newly_finalized;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_async_payment(uuid, text, text, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_async_payment(uuid, text, text, uuid, numeric, text) TO service_role;