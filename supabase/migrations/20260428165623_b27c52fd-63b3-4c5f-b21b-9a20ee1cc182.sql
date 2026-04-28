
-- Extend orders for incomplete orders system
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_failure_reason text,
  ADD COLUMN IF NOT EXISTS last_payment_attempt_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS auto_cancel_after_hours integer DEFAULT 48,
  ADD COLUMN IF NOT EXISTS bank_transfer_reference text,
  ADD COLUMN IF NOT EXISTS bank_transfer_proof_url text,
  ADD COLUMN IF NOT EXISTS bank_transfer_reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_released_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_stage text;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON public.orders(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_payment ON public.orders(status, payment_status);

-- Function to release reserved stock for expired orders
CREATE OR REPLACE FUNCTION public.release_expired_order_stock(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN 
    SELECT product_id, qty FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL
  LOOP
    UPDATE public.products 
    SET reserved_stock = GREATEST(0, COALESCE(reserved_stock,0) - item.qty)
    WHERE id = item.product_id;
  END LOOP;
  
  UPDATE public.orders 
  SET stock_reserved = false, 
      stock_released_at = now()
  WHERE id = _order_id;
END;
$$;

-- Function to auto-cancel expired pending orders + release stock
CREATE OR REPLACE FUNCTION public.auto_cancel_expired_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer := 0;
  o RECORD;
BEGIN
  FOR o IN
    SELECT id FROM public.orders
    WHERE status = 'pending'
      AND payment_status IN ('unpaid','failed','pending_review')
      AND expires_at IS NOT NULL 
      AND expires_at < now()
  LOOP
    IF EXISTS (SELECT 1 FROM public.orders WHERE id = o.id AND stock_reserved = true) THEN
      PERFORM public.release_expired_order_stock(o.id);
    END IF;
    UPDATE public.orders 
    SET status = 'cancelled',
        payment_status = 'expired',
        updated_at = now(),
        internal_notes = COALESCE(internal_notes,'[]'::jsonb) || 
          jsonb_build_array(jsonb_build_object('text','إلغاء تلقائي بعد انتهاء المهلة','at',now(),'system',true))
    WHERE id = o.id;
    cancelled_count := cancelled_count + 1;
  END LOOP;
  RETURN cancelled_count;
END;
$$;
