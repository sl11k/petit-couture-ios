-- 1) Deterministic advisory locks so concurrent orders on the same unit serialize
CREATE OR REPLACE FUNCTION public.lock_order_stock_units(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE k RECORD;
BEGIN
  -- serialize on the order itself (guards webhook re-delivery / double submit)
  PERFORM pg_advisory_xact_lock(hashtextextended('order:' || _order_id::text, 0));

  -- then lock every distinct stock unit, always in the same global order => no deadlocks
  FOR k IN
    SELECT DISTINCT hashtextextended(
             'unit:' || COALESCE(oi.variant_id::text, oi.product_id::text, oi.product_slug, ''), 0) AS h
      FROM public.order_items oi
     WHERE oi.order_id = _order_id
     ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(k.h);
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lock_order_stock_units(uuid) TO service_role;

-- 2) Non-negative guarantees at the storage level
ALTER TABLE public.products
  ADD CONSTRAINT products_stock_non_negative CHECK (stock IS NULL OR stock >= 0) NOT VALID;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_stock_non_negative CHECK (stock IS NULL OR stock >= 0) NOT VALID;
ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_quantities_non_negative
  CHECK (quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= quantity) NOT VALID;

-- 3) Reserve: strict, locked, no clamping
CREATE OR REPLACE FUNCTION public.reserve_order_inventory(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  it RECORD;
  o RECORD;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_country text; v_region text; v_city text;
  v_lat numeric; v_lng numeric;
  v_available integer;
  v_rowcount integer;
BEGIN
  PERFORM public.lock_order_stock_units(_order_id);

  SELECT shipping_address, shipping_lat, shipping_lng, stock_reserved_at, payment_stock_finalized_at
    INTO o
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- idempotent: already reserved or already finalized => no-op
  IF o.stock_reserved_at IS NOT NULL OR o.payment_stock_finalized_at IS NOT NULL THEN
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
    IF COALESCE(it.qty, 0) <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for order item %', it.id;
    END IF;

    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Cannot reserve stock: product not found for order item %', it.id;
    END IF;

    -- row lock on the exact stock unit
    IF it.variant_id IS NOT NULL THEN
      SELECT COALESCE(stock, 0) INTO v_available
        FROM public.product_variants WHERE id = it.variant_id FOR UPDATE;
    ELSE
      SELECT COALESCE(stock, 0) INTO v_available
        FROM public.products WHERE id = v_product_id FOR UPDATE;
    END IF;

    IF COALESCE(v_available, 0) < it.qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: order item % requested %, available %', it.id, it.qty, COALESCE(v_available, 0);
    END IF;

    v_warehouse_id := it.warehouse_id;
    IF v_warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng);
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
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: warehouse stock unavailable for order item %', it.id;
      END IF;
    END IF;

    IF it.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET stock = stock - it.qty
       WHERE id = it.variant_id AND COALESCE(stock, 0) >= it.qty;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: variant stock changed concurrently for order item %', it.id;
      END IF;

      UPDATE public.products
         SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
       WHERE id = v_product_id;
    ELSE
      UPDATE public.products
         SET stock = stock - it.qty
       WHERE id = v_product_id AND COALESCE(stock, 0) >= it.qty;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: product stock changed concurrently for order item %', it.id;
      END IF;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id,
           warehouse_id = COALESCE(v_warehouse_id, warehouse_id)
     WHERE id = it.id;

    PERFORM public.log_inventory_movement(
      'reserved', it.qty, -it.qty, _order_id, it.id, v_product_id, it.variant_id, v_warehouse_id,
      v_available, public.current_unit_stock(v_product_id, it.variant_id),
      'checkout.reserve', 'حجز المخزون عند إنشاء الطلب (مع قفل تزامن)');
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = now(), updated_at = now()
   WHERE id = _order_id;
END;
$function$;

-- 4) Finalize: idempotent against webhook re-delivery, strict, locked
CREATE OR REPLACE FUNCTION public.finalize_order_stock(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  it RECORD;
  o RECORD;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_country text; v_region text; v_city text;
  v_lat numeric; v_lng numeric;
  v_was_reserved boolean;
  v_already_reserved_order boolean;
  v_available integer;
  v_before integer;
  v_rowcount integer;
BEGIN
  PERFORM public.lock_order_stock_units(_order_id);

  SELECT shipping_address, shipping_lat, shipping_lng, stock_reserved_at, payment_stock_finalized_at
    INTO o
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- webhook re-delivery / double confirmation => no-op
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
    IF COALESCE(it.qty, 0) <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for order item %', it.id;
    END IF;

    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Cannot finalize stock: product not found for order item %', it.id;
    END IF;

    v_before := public.current_unit_stock(v_product_id, it.variant_id);
    v_was_reserved := (v_already_reserved_order AND it.warehouse_id IS NOT NULL);
    v_warehouse_id := it.warehouse_id;

    IF v_warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng);
    END IF;

    IF v_was_reserved THEN
      -- convert reservation into a real deduction (unit stock already decremented at reserve time)
      UPDATE public.inventory
         SET reserved_quantity = reserved_quantity - it.qty,
             quantity = quantity - it.qty
       WHERE product_id = v_product_id
         AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND warehouse_id = v_warehouse_id
         AND reserved_quantity >= it.qty
         AND quantity >= it.qty;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'Reserved stock missing for order item %', it.id;
      END IF;
    ELSE
      IF it.variant_id IS NOT NULL THEN
        SELECT COALESCE(stock, 0) INTO v_available
          FROM public.product_variants WHERE id = it.variant_id FOR UPDATE;
      ELSE
        SELECT COALESCE(stock, 0) INTO v_available
          FROM public.products WHERE id = v_product_id FOR UPDATE;
      END IF;

      IF COALESCE(v_available, 0) < it.qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: order item % requested %, available %', it.id, it.qty, COALESCE(v_available, 0);
      END IF;

      IF v_warehouse_id IS NOT NULL THEN
        UPDATE public.inventory
           SET quantity = quantity - it.qty
         WHERE product_id = v_product_id
           AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND warehouse_id = v_warehouse_id
           AND status = 'active'
           AND (quantity - reserved_quantity) >= it.qty;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK: warehouse stock unavailable for order item %', it.id;
        END IF;
      END IF;

      IF it.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock = stock - it.qty
         WHERE id = it.variant_id AND COALESCE(stock, 0) >= it.qty;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK: variant stock changed concurrently for order item %', it.id;
        END IF;

        UPDATE public.products
           SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
         WHERE id = v_product_id;
      ELSE
        UPDATE public.products
           SET stock = stock - it.qty
         WHERE id = v_product_id AND COALESCE(stock, 0) >= it.qty;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK: product stock changed concurrently for order item %', it.id;
        END IF;
      END IF;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id,
           warehouse_id = COALESCE(v_warehouse_id, warehouse_id)
     WHERE id = it.id;

    PERFORM public.log_inventory_movement(
      'deducted', it.qty, CASE WHEN v_was_reserved THEN 0 ELSE -it.qty END,
      _order_id, it.id, v_product_id, it.variant_id, v_warehouse_id,
      v_before, public.current_unit_stock(v_product_id, it.variant_id),
      'payment.confirmed',
      CASE WHEN v_was_reserved THEN 'تحويل الحجز إلى خصم نهائي بعد تأكيد الدفع'
           ELSE 'خصم مباشر من المخزون بعد تأكيد الدفع' END);
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = COALESCE(stock_reserved_at, now()),
         payment_stock_finalized_at = now(),
         updated_at = now()
   WHERE id = _order_id;
END;
$function$;

-- 5) Release: locked + idempotent (never double-restores)
CREATE OR REPLACE FUNCTION public.release_order_inventory(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  it RECORD;
  o RECORD;
  v_product_id uuid;
  v_should_restore boolean;
  v_was_finalized boolean;
  v_before integer;
BEGIN
  PERFORM public.lock_order_stock_units(_order_id);

  SELECT stock_reserved_at, payment_stock_finalized_at
    INTO o
    FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_should_restore := (o.stock_reserved_at IS NOT NULL);
  v_was_finalized := (o.payment_stock_finalized_at IS NOT NULL);

  IF NOT v_should_restore THEN
    RETURN; -- nothing held for this order
  END IF;

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items WHERE order_id = _order_id ORDER BY id
  LOOP
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN
      CONTINUE;
    END IF;

    v_before := public.current_unit_stock(v_product_id, it.variant_id);

    IF it.warehouse_id IS NOT NULL THEN
      UPDATE public.inventory
         SET reserved_quantity = CASE WHEN v_was_finalized THEN reserved_quantity
                                      ELSE GREATEST(0, reserved_quantity - it.qty) END,
             quantity = CASE WHEN v_was_finalized THEN quantity + it.qty ELSE quantity END
       WHERE product_id = v_product_id
         AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND warehouse_id = it.warehouse_id;
    END IF;

    UPDATE public.products
       SET stock = COALESCE(stock, 0) + it.qty
     WHERE id = v_product_id;

    IF it.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET stock = COALESCE(stock, 0) + it.qty
       WHERE id = it.variant_id;
    END IF;

    PERFORM public.log_inventory_movement(
      CASE WHEN v_was_finalized THEN 'returned' ELSE 'released' END,
      it.qty, it.qty, _order_id, it.id, v_product_id, it.variant_id, it.warehouse_id,
      v_before, public.current_unit_stock(v_product_id, it.variant_id),
      CASE WHEN v_was_finalized THEN 'payment.refunded_or_cancelled' ELSE 'order.released' END,
      'إرجاع الكمية إلى المخزون');
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = NULL,
         payment_stock_finalized_at = NULL,
         updated_at = now()
   WHERE id = _order_id;
END;
$function$;