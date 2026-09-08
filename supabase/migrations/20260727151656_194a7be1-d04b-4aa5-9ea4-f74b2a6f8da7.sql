CREATE OR REPLACE FUNCTION public.reserve_order_inventory(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it RECORD;
  o RECORD;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_country text;
  v_region text;
  v_city text;
  v_lat numeric;
  v_lng numeric;
  v_already_reserved boolean;
  v_available integer;
  v_rowcount integer;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng, stock_reserved_at
    INTO o
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_already_reserved := (o.stock_reserved_at IS NOT NULL);
  IF v_already_reserved THEN
    RETURN;
  END IF;

  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region := o.shipping_address->>'region';
  v_city := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat := o.shipping_lat;
  v_lng := o.shipping_lng;

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items
     WHERE order_id = _order_id
     ORDER BY id
  LOOP
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Cannot reserve stock: product not found for order item %', it.id;
    END IF;

    IF it.variant_id IS NOT NULL THEN
      SELECT COALESCE(stock, 0) INTO v_available
        FROM public.product_variants
       WHERE id = it.variant_id
       FOR UPDATE;
    ELSE
      SELECT COALESCE(stock, 0) INTO v_available
        FROM public.products
       WHERE id = v_product_id
       FOR UPDATE;
    END IF;

    IF COALESCE(v_available, 0) < it.qty THEN
      RAISE EXCEPTION 'Insufficient stock for order item %: requested %, available %', it.id, it.qty, COALESCE(v_available, 0);
    END IF;

    v_warehouse_id := it.warehouse_id;
    IF v_warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng
      );
    END IF;

    IF v_warehouse_id IS NOT NULL THEN
      UPDATE public.inventory
         SET reserved_quantity = reserved_quantity + it.qty
       WHERE product_id = v_product_id
         AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND warehouse_id = v_warehouse_id
         AND status = 'active'
         AND (quantity - reserved_quantity) >= it.qty;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'Insufficient warehouse stock for order item %', it.id;
      END IF;
    END IF;

    UPDATE public.products
       SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
     WHERE id = v_product_id;

    IF it.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
       WHERE id = it.variant_id;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id,
           warehouse_id = COALESCE(v_warehouse_id, warehouse_id)
     WHERE id = it.id;
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = now(),
         updated_at = now()
   WHERE id = _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_order_stock(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it RECORD;
  o RECORD;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_country text;
  v_region text;
  v_city text;
  v_lat numeric;
  v_lng numeric;
  v_was_reserved boolean;
  v_already_reserved_order boolean;
  v_available integer;
  v_rowcount integer;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng, stock_reserved_at, payment_stock_finalized_at
    INTO o
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF o.payment_stock_finalized_at IS NOT NULL THEN
    RETURN;
  END IF;

  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region := o.shipping_address->>'region';
  v_city := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat := o.shipping_lat;
  v_lng := o.shipping_lng;
  v_already_reserved_order := (o.stock_reserved_at IS NOT NULL);

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items
     WHERE order_id = _order_id
     ORDER BY id
  LOOP
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Cannot finalize stock: product not found for order item %', it.id;
    END IF;

    v_was_reserved := (v_already_reserved_order AND it.warehouse_id IS NOT NULL);
    v_warehouse_id := it.warehouse_id;

    IF v_warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng
      );
    END IF;

    IF v_was_reserved THEN
      UPDATE public.inventory
         SET reserved_quantity = GREATEST(0, reserved_quantity - it.qty),
             quantity = GREATEST(0, quantity - it.qty)
       WHERE product_id = v_product_id
         AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND warehouse_id = v_warehouse_id
         AND reserved_quantity >= it.qty;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'Reserved stock missing for order item %', it.id;
      END IF;
    ELSE
      IF it.variant_id IS NOT NULL THEN
        SELECT COALESCE(stock, 0) INTO v_available
          FROM public.product_variants
         WHERE id = it.variant_id
         FOR UPDATE;
      ELSE
        SELECT COALESCE(stock, 0) INTO v_available
          FROM public.products
         WHERE id = v_product_id
         FOR UPDATE;
      END IF;

      IF COALESCE(v_available, 0) < it.qty THEN
        RAISE EXCEPTION 'Insufficient stock for order item %: requested %, available %', it.id, it.qty, COALESCE(v_available, 0);
      END IF;

      IF v_warehouse_id IS NOT NULL THEN
        UPDATE public.inventory
           SET quantity = GREATEST(0, quantity - it.qty)
         WHERE product_id = v_product_id
           AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND warehouse_id = v_warehouse_id
           AND status = 'active'
           AND (quantity - reserved_quantity) >= it.qty;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'Insufficient warehouse stock for order item %', it.id;
        END IF;
      END IF;

      UPDATE public.products
         SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
       WHERE id = v_product_id;

      IF it.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
         WHERE id = it.variant_id;
      END IF;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id,
           warehouse_id = COALESCE(v_warehouse_id, warehouse_id)
     WHERE id = it.id;
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = COALESCE(stock_reserved_at, now()),
         payment_stock_finalized_at = now(),
         updated_at = now()
   WHERE id = _order_id;
END;
$$;

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
SET search_path TO 'public'
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