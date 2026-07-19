CREATE OR REPLACE FUNCTION public.record_order_coupon_redemption(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND OR o.coupon_id IS NULL OR coalesce(o.discount_amount, 0) <= 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coupon_redemptions AS r
    WHERE r.order_id = _order_id
      AND r.coupon_id = o.coupon_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.coupon_redemptions (
    coupon_id,
    order_id,
    user_id,
    customer_email,
    customer_phone,
    discount_amount,
    order_total
  ) VALUES (
    o.coupon_id,
    o.id,
    o.user_id,
    o.customer_email,
    o.customer_phone,
    coalesce(o.discount_amount, 0),
    coalesce(o.total, 0)
  );

  UPDATE public.coupons AS c
  SET used_count = coalesce(c.used_count, 0) + 1,
      discount_total = coalesce(c.discount_total, 0) + coalesce(o.discount_amount, 0),
      revenue_total = coalesce(c.revenue_total, 0) + coalesce(o.total, 0),
      updated_at = now()
  WHERE c.id = o.coupon_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_order_coupon_redemption(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_async_payment(_order_id uuid, _gateway text, _gateway_transaction_id text, _transaction_id uuid, _amount numeric, _currency text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  newly_finalized boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.payment_method::text <> _gateway THEN RAISE EXCEPTION 'Payment method mismatch'; END IF;
  IF abs(o.total - _amount) > 0.01 THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  IF upper(o.currency) <> upper(_currency) THEN RAISE EXCEPTION 'Payment currency mismatch'; END IF;

  IF o.payment_status = 'paid' THEN
    UPDATE public.orders
       SET payment_stock_finalized_at = COALESCE(payment_stock_finalized_at, now()),
           updated_at = now()
     WHERE id = _order_id;
    PERFORM public.record_order_coupon_redemption(_order_id);
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

  PERFORM public.record_order_coupon_redemption(_order_id);

  RETURN newly_finalized;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_async_payment(uuid, text, text, uuid, numeric, text) TO service_role;