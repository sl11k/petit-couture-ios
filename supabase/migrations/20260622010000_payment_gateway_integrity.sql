-- Payment gateway integrity and idempotency.
-- REQUIRED before deploying the accompanying Tabby/Tamara/OTO code.
-- This migration is non-destructive and may be run manually in Supabase.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_stock_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_inventory_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS oto_creation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS oto_creation_error text;

-- Atomically mark an async gateway order paid and convert its reservation into
-- committed inventory exactly once. The row lock prevents duplicate webhooks
-- from decrementing stock twice.
CREATE OR REPLACE FUNCTION public.complete_async_payment(
  _order_id uuid,
  _gateway text,
  _gateway_transaction_id text,
  _transaction_id uuid,
  _amount numeric,
  _currency text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $complete_payment$
DECLARE
  o public.orders%ROWTYPE;
  newly_finalized boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.payment_method::text <> _gateway THEN RAISE EXCEPTION 'Payment method mismatch'; END IF;
  IF abs(o.total - _amount) > 0.01 THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  IF upper(o.currency) <> upper(_currency) THEN RAISE EXCEPTION 'Payment currency mismatch'; END IF;

  -- A paid order created before this migration has no marker. Treat it as
  -- already finalized rather than risking a second stock decrement when an old
  -- provider event is replayed after deployment.
  IF o.payment_status = 'paid' THEN
    UPDATE public.orders
       SET payment_stock_finalized_at = COALESCE(payment_stock_finalized_at, now()),
           updated_at = now()
     WHERE id = _order_id;
    RETURN false;
  END IF;

  IF o.payment_stock_finalized_at IS NULL THEN
    PERFORM public.finalize_order_stock(_order_id);
    newly_finalized := true;
  END IF;

  UPDATE public.orders
     SET payment_status = 'paid',
         status = CASE WHEN status = 'pending' THEN 'processing'::public.order_status ELSE status END,
         payment_gateway = _gateway,
         last_transaction_id = _transaction_id,
         captured_amount = _amount,
         payment_failure_reason = NULL,
         payment_stock_finalized_at = COALESCE(payment_stock_finalized_at, now()),
         updated_at = now()
   WHERE id = _order_id;

  RETURN newly_finalized;
END;
$complete_payment$;

-- Release a reservation once when a gateway definitively rejects or expires a
-- payment. A paid order can never be moved backwards by a late failure event.
CREATE OR REPLACE FUNCTION public.fail_async_payment(
  _order_id uuid,
  _gateway text,
  _transaction_id uuid,
  _reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fail_payment$
DECLARE
  o public.orders%ROWTYPE;
  newly_released boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.payment_method::text <> _gateway THEN RAISE EXCEPTION 'Payment method mismatch'; END IF;
  IF o.payment_status = 'paid' THEN RETURN false; END IF;

  IF o.payment_inventory_released_at IS NULL AND o.payment_stock_finalized_at IS NULL THEN
    PERFORM public.release_order_inventory(_order_id);
    newly_released := true;
  END IF;

  UPDATE public.orders
     SET payment_status = 'failed',
         payment_gateway = _gateway,
         last_transaction_id = _transaction_id,
         payment_failure_reason = left(_reason, 500),
         payment_inventory_released_at = COALESCE(payment_inventory_released_at, now()),
         updated_at = now()
   WHERE id = _order_id;
  RETURN newly_released;
END;
$fail_payment$;

-- Record a provider-confirmed full refund without changing inventory. Physical
-- stock is returned only through the separate returns workflow.
CREATE OR REPLACE FUNCTION public.refund_async_payment(
  _order_id uuid,
  _gateway text,
  _transaction_id uuid,
  _amount numeric,
  _currency text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $refund_payment$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.payment_method::text <> _gateway THEN RAISE EXCEPTION 'Payment method mismatch'; END IF;
  IF abs(o.total - _amount) > 0.01 THEN RAISE EXCEPTION 'Refund amount mismatch'; END IF;
  IF upper(o.currency) <> upper(_currency) THEN RAISE EXCEPTION 'Refund currency mismatch'; END IF;
  IF o.payment_status = 'refunded' THEN RETURN false; END IF;
  IF o.payment_status <> 'paid' THEN RAISE EXCEPTION 'Only a paid order can be refunded'; END IF;

  UPDATE public.orders
     SET payment_status = 'refunded',
         status = 'refunded',
         refunded_amount = _amount,
         last_transaction_id = _transaction_id,
         updated_at = now()
   WHERE id = _order_id;
  RETURN true;
END;
$refund_payment$;

-- Claim OTO creation before the external API call. Only one concurrent webhook
-- or manual retry can own the claim, preventing duplicate carrier orders.
CREATE OR REPLACE FUNCTION public.claim_oto_shipment_creation(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claim_oto$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.oto_creation_started_at IS NOT NULL
     AND o.oto_creation_error IS NULL
     AND o.oto_creation_started_at > now() - interval '10 minutes'
  THEN
    RETURN false;
  END IF;

  UPDATE public.orders
     SET oto_creation_started_at = now(), oto_creation_error = NULL, updated_at = now()
   WHERE id = _order_id;
  RETURN true;
END;
$claim_oto$;

REVOKE ALL ON FUNCTION public.complete_async_payment(uuid,text,text,uuid,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_async_payment(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_async_payment(uuid,text,uuid,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_oto_shipment_creation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_async_payment(uuid,text,text,uuid,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_async_payment(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_async_payment(uuid,text,uuid,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_oto_shipment_creation(uuid) TO service_role;
