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
  v_order_was_reserved boolean;
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

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.payment_stock_finalized_at IS NOT NULL THEN RETURN; END IF;

  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region := o.shipping_address->>'region';
  v_city := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat := o.shipping_lat;
  v_lng := o.shipping_lng;
  v_order_was_reserved := (o.stock_reserved_at IS NOT NULL);

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
    v_warehouse_id := it.warehouse_id;

    IF v_order_was_reserved THEN
      -- reserve_order_inventory already decremented the product/variant unit stock.
      -- Only convert a warehouse reservation when this item was assigned a warehouse.
      IF v_warehouse_id IS NOT NULL THEN
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
          RAISE EXCEPTION 'Reserved warehouse stock missing for order item %', it.id;
        END IF;
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

      IF v_warehouse_id IS NULL THEN
        v_warehouse_id := public.pick_warehouse_for_item(
          v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng);
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
        UPDATE public.product_variants SET stock = stock - it.qty
         WHERE id = it.variant_id AND COALESCE(stock, 0) >= it.qty;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK: variant stock changed concurrently for order item %', it.id;
        END IF;
        UPDATE public.products SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
         WHERE id = v_product_id;
      ELSE
        UPDATE public.products SET stock = stock - it.qty
         WHERE id = v_product_id AND COALESCE(stock, 0) >= it.qty;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount = 0 THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK: product stock changed concurrently for order item %', it.id;
        END IF;
      END IF;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id, warehouse_id = COALESCE(v_warehouse_id, warehouse_id)
     WHERE id = it.id;

    PERFORM public.log_inventory_movement(
      'deducted', it.qty, CASE WHEN v_order_was_reserved THEN 0 ELSE -it.qty END,
      _order_id, it.id, v_product_id, it.variant_id, v_warehouse_id,
      v_before, public.current_unit_stock(v_product_id, it.variant_id),
      'payment.confirmed',
      CASE WHEN v_order_was_reserved THEN 'تحويل الحجز إلى خصم نهائي بعد تأكيد الدفع'
           ELSE 'خصم مباشر من المخزون بعد تأكيد الدفع' END);
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = COALESCE(stock_reserved_at, now()),
         payment_stock_finalized_at = now(), updated_at = now()
   WHERE id = _order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_order_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_stock(uuid) TO service_role;