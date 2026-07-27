CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  movement_type text NOT NULL CHECK (movement_type IN ('reserved','deducted','returned','released')),
  qty integer NOT NULL,
  delta integer NOT NULL,
  order_id uuid,
  order_number text,
  order_item_id uuid,
  product_id uuid,
  variant_id uuid,
  warehouse_id uuid,
  product_name text,
  sku text,
  stock_before integer,
  stock_after integer,
  order_status text,
  payment_status text,
  payment_event text,
  source text NOT NULL DEFAULT 'system',
  actor_id uuid,
  notes text
);

CREATE INDEX IF NOT EXISTS inventory_ledger_order_idx ON public.inventory_ledger(order_id);
CREATE INDEX IF NOT EXISTS inventory_ledger_product_idx ON public.inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS inventory_ledger_created_idx ON public.inventory_ledger(created_at DESC);

GRANT SELECT ON public.inventory_ledger TO authenticated;
GRANT ALL ON public.inventory_ledger TO service_role;

ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inventory ledger"
ON public.inventory_ledger FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'inventory_manager')
  OR public.has_role(auth.uid(), 'store_manager')
  OR public.has_role(auth.uid(), 'orders_manager')
  OR public.has_permission(auth.uid(), 'inventory.read')
);

CREATE OR REPLACE FUNCTION public.log_inventory_movement(
  _movement_type text,
  _qty integer,
  _delta integer,
  _order_id uuid,
  _order_item_id uuid,
  _product_id uuid,
  _variant_id uuid,
  _warehouse_id uuid,
  _stock_before integer,
  _stock_after integer,
  _payment_event text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o RECORD;
  p RECORD;
BEGIN
  SELECT order_number, status::text AS status, payment_status::text AS payment_status
    INTO o FROM public.orders WHERE id = _order_id;

  SELECT COALESCE(name_ar, name_en) AS pname, sku INTO p
    FROM public.products WHERE id = _product_id;

  INSERT INTO public.inventory_ledger(
    movement_type, qty, delta, order_id, order_number, order_item_id,
    product_id, variant_id, warehouse_id, product_name, sku,
    stock_before, stock_after, order_status, payment_status, payment_event, source, actor_id, notes
  ) VALUES (
    _movement_type, _qty, _delta, _order_id, o.order_number, _order_item_id,
    _product_id, _variant_id, _warehouse_id, p.pname, p.sku,
    _stock_before, _stock_after, o.status, o.payment_status, _payment_event, 'system', auth.uid(), _notes
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_inventory_movement failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_unit_stock(_product_id uuid, _variant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _variant_id IS NOT NULL THEN (SELECT COALESCE(stock,0) FROM public.product_variants WHERE id = _variant_id)
    ELSE (SELECT COALESCE(stock,0) FROM public.products WHERE id = _product_id)
  END;
$$;

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

    PERFORM public.log_inventory_movement(
      'reserved', it.qty, -it.qty, _order_id, it.id, v_product_id, it.variant_id, v_warehouse_id,
      v_available, public.current_unit_stock(v_product_id, it.variant_id),
      'checkout.reserve', 'حجز المخزون عند إنشاء الطلب'
    );
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = now(),
         updated_at = now()
   WHERE id = _order_id;
END;
$function$;

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
  v_country text;
  v_region text;
  v_city text;
  v_lat numeric;
  v_lng numeric;
  v_was_reserved boolean;
  v_already_reserved_order boolean;
  v_available integer;
  v_before integer;
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

    v_before := public.current_unit_stock(v_product_id, it.variant_id);
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

    PERFORM public.log_inventory_movement(
      'deducted', it.qty, CASE WHEN v_was_reserved THEN 0 ELSE -it.qty END,
      _order_id, it.id, v_product_id, it.variant_id, v_warehouse_id,
      v_before, public.current_unit_stock(v_product_id, it.variant_id),
      'payment.confirmed',
      CASE WHEN v_was_reserved THEN 'تحويل الحجز إلى خصم نهائي بعد تأكيد الدفع'
           ELSE 'خصم مباشر من المخزون بعد تأكيد الدفع' END
    );
  END LOOP;

  UPDATE public.orders
     SET stock_reserved_at = COALESCE(stock_reserved_at, now()),
         payment_stock_finalized_at = now(),
         updated_at = now()
   WHERE id = _order_id;
END;
$function$;

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
  v_before integer;
BEGIN
  SELECT stock_reserved_at, payment_stock_finalized_at, status::text AS status, payment_status::text AS payment_status
    INTO o
    FROM public.orders WHERE id = _order_id FOR UPDATE;

  v_should_restore := (o.stock_reserved_at IS NOT NULL);

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items WHERE order_id = _order_id
  LOOP
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;

    v_before := public.current_unit_stock(v_product_id, it.variant_id);

    IF it.warehouse_id IS NOT NULL AND v_product_id IS NOT NULL THEN
      UPDATE public.inventory
         SET reserved_quantity = GREATEST(0, reserved_quantity - it.qty),
             quantity = CASE WHEN o.payment_stock_finalized_at IS NOT NULL THEN quantity + it.qty ELSE quantity END
       WHERE product_id = v_product_id
         AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND warehouse_id = it.warehouse_id;
    END IF;

    IF v_should_restore AND v_product_id IS NOT NULL THEN
      UPDATE public.products
         SET stock = COALESCE(stock, 0) + it.qty
       WHERE id = v_product_id;

      IF it.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock = COALESCE(stock, 0) + it.qty
         WHERE id = it.variant_id;
      END IF;

      PERFORM public.log_inventory_movement(
        CASE WHEN o.payment_stock_finalized_at IS NOT NULL THEN 'returned' ELSE 'released' END,
        it.qty, it.qty, _order_id, it.id, v_product_id, it.variant_id, it.warehouse_id,
        v_before, public.current_unit_stock(v_product_id, it.variant_id),
        CASE WHEN o.payment_stock_finalized_at IS NOT NULL THEN 'payment.refunded_or_cancelled' ELSE 'order.released' END,
        'إرجاع الكمية إلى المخزون'
      );
    END IF;
  END LOOP;

  IF v_should_restore THEN
    UPDATE public.orders
       SET stock_reserved_at = NULL,
           payment_stock_finalized_at = NULL
     WHERE id = _order_id;
  END IF;
END;
$function$;