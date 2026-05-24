
-- 1. Reserve inventory at order placement (when payment not yet confirmed)
CREATE OR REPLACE FUNCTION public.reserve_order_inventory(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
  o RECORD;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_country text; v_region text; v_city text;
  v_lat numeric; v_lng numeric;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng INTO o
    FROM public.orders WHERE id = _order_id;
  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region  := o.shipping_address->>'region';
  v_city    := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat     := o.shipping_lat;
  v_lng     := o.shipping_lng;

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items WHERE order_id = _order_id
  LOOP
    -- Skip if already reserved (has warehouse_id set)
    IF it.warehouse_id IS NOT NULL THEN CONTINUE; END IF;

    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN CONTINUE; END IF;

    v_warehouse_id := public.pick_warehouse_for_item(
      v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng
    );
    IF v_warehouse_id IS NULL THEN CONTINUE; END IF;

    UPDATE public.inventory
       SET reserved_quantity = reserved_quantity + it.qty
     WHERE product_id = v_product_id
       AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND warehouse_id = v_warehouse_id;

    UPDATE public.order_items
       SET product_id = v_product_id, warehouse_id = v_warehouse_id
     WHERE id = it.id;
  END LOOP;
END;
$$;

-- 2. Release inventory reservation
CREATE OR REPLACE FUNCTION public.release_order_inventory(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
BEGIN
  FOR it IN
    SELECT id, product_id, variant_id, warehouse_id, qty
      FROM public.order_items
     WHERE order_id = _order_id AND warehouse_id IS NOT NULL
  LOOP
    UPDATE public.inventory
       SET reserved_quantity = GREATEST(0, reserved_quantity - it.qty)
     WHERE product_id = it.product_id
       AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND warehouse_id = it.warehouse_id;
  END LOOP;
END;
$$;

-- 3. Update finalize_order_stock to clear any prior reservation
CREATE OR REPLACE FUNCTION public.finalize_order_stock(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD; o RECORD;
  v_product_id uuid; v_warehouse_id uuid;
  v_country text; v_region text; v_city text;
  v_lat numeric; v_lng numeric;
  v_was_reserved boolean;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng INTO o
    FROM public.orders WHERE id = _order_id;
  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region  := o.shipping_address->>'region';
  v_city    := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat     := o.shipping_lat;
  v_lng     := o.shipping_lng;

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items WHERE order_id = _order_id
  LOOP
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN CONTINUE; END IF;

    v_was_reserved := (it.warehouse_id IS NOT NULL);
    v_warehouse_id := it.warehouse_id;
    IF v_warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng
      );
    END IF;

    IF v_warehouse_id IS NOT NULL THEN
      IF v_was_reserved THEN
        -- Convert reservation: drop both reserved + on-hand
        UPDATE public.inventory
           SET quantity = GREATEST(0, quantity - it.qty),
               reserved_quantity = GREATEST(0, reserved_quantity - it.qty)
         WHERE product_id = v_product_id
           AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND warehouse_id = v_warehouse_id;
      ELSE
        UPDATE public.inventory
           SET quantity = GREATEST(0, quantity - it.qty)
         WHERE product_id = v_product_id
           AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND warehouse_id = v_warehouse_id;
      END IF;
    ELSE
      UPDATE public.products SET stock = GREATEST(0, stock - it.qty) WHERE id = v_product_id;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id, warehouse_id = v_warehouse_id
     WHERE id = it.id;

    UPDATE public.products
       SET sales_count = COALESCE(sales_count, 0) + it.qty
     WHERE id = v_product_id;
  END LOOP;
END;
$$;

-- 4. Stock transfer between warehouses
CREATE OR REPLACE FUNCTION public.transfer_inventory(
  _product_id uuid, _variant_id uuid,
  _from_warehouse uuid, _to_warehouse uuid, _qty integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available integer;
BEGIN
  IF _qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;
  IF _from_warehouse = _to_warehouse THEN RAISE EXCEPTION 'source = destination'; END IF;

  -- Authorization: admin or staff only
  IF NOT (public.has_role(auth.uid(),'super_admin')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT (quantity - reserved_quantity) INTO v_available
    FROM public.inventory
   WHERE product_id = _product_id
     AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND warehouse_id = _from_warehouse
   FOR UPDATE;

  IF v_available IS NULL OR v_available < _qty THEN
    RAISE EXCEPTION 'insufficient stock at source warehouse';
  END IF;

  UPDATE public.inventory
     SET quantity = quantity - _qty
   WHERE product_id = _product_id
     AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND warehouse_id = _from_warehouse;

  INSERT INTO public.inventory (product_id, variant_id, warehouse_id, quantity)
  VALUES (_product_id, _variant_id, _to_warehouse, _qty)
  ON CONFLICT (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id)
  DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity,
                updated_at = now();
END;
$$;

-- 5. Admin reassign order item warehouse (moves reservation if any)
CREATE OR REPLACE FUNCTION public.reassign_order_item_warehouse(
  _item_id uuid, _new_warehouse uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, product_id, variant_id, warehouse_id, qty
    INTO it FROM public.order_items WHERE id = _item_id;
  IF it IS NULL THEN RAISE EXCEPTION 'item not found'; END IF;
  IF it.warehouse_id = _new_warehouse THEN RETURN; END IF;

  -- If item had a prior reservation, release it from the old warehouse
  IF it.warehouse_id IS NOT NULL THEN
    UPDATE public.inventory
       SET reserved_quantity = GREATEST(0, reserved_quantity - it.qty)
     WHERE product_id = it.product_id
       AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND warehouse_id = it.warehouse_id;
  END IF;

  -- Reserve at the new warehouse (ensure row exists)
  INSERT INTO public.inventory (product_id, variant_id, warehouse_id, quantity, reserved_quantity)
  VALUES (it.product_id, it.variant_id, _new_warehouse, 0, it.qty)
  ON CONFLICT (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id)
  DO UPDATE SET reserved_quantity = public.inventory.reserved_quantity + EXCLUDED.reserved_quantity,
                updated_at = now();

  UPDATE public.order_items SET warehouse_id = _new_warehouse WHERE id = _item_id;
END;
$$;

-- 6. Hook into auto_cancel to also release inventory reservations
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
      AND expires_at IS NOT NULL AND expires_at < now()
  LOOP
    IF EXISTS (SELECT 1 FROM public.orders WHERE id = o.id AND stock_reserved = true) THEN
      PERFORM public.release_expired_order_stock(o.id);
    END IF;
    PERFORM public.release_order_inventory(o.id);

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
