
-- 1. Picker: choose best warehouse for a given product/variant + qty + destination
CREATE OR REPLACE FUNCTION public.pick_warehouse_for_item(
  _product_id uuid,
  _variant_id uuid,
  _qty integer,
  _country text,
  _region text,
  _city text,
  _lat numeric,
  _lng numeric
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT i.warehouse_id INTO v_id
  FROM public.inventory i
  JOIN public.warehouses w ON w.id = i.warehouse_id
  WHERE i.product_id = _product_id
    AND COALESCE(i.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND i.status = 'active'
    AND w.status = 'active'
    AND (i.quantity - i.reserved_quantity) >= _qty
  ORDER BY
    (w.country_code IS NOT DISTINCT FROM _country) DESC,
    (w.region IS NOT DISTINCT FROM _region) DESC,
    (w.city IS NOT DISTINCT FROM _city) DESC,
    CASE
      WHEN _lat IS NOT NULL AND _lng IS NOT NULL
           AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
      THEN (
        2 * 6371 * asin(sqrt(
          power(sin(radians((w.latitude - _lat) / 2)), 2)
          + cos(radians(_lat)) * cos(radians(w.latitude))
            * power(sin(radians((w.longitude - _lng) / 2)), 2)
        ))
      )
      ELSE 1e9
    END ASC,
    w.priority ASC,
    i.quantity DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- 2. Replace finalize_order_stock to use inventory + nearest warehouse
CREATE OR REPLACE FUNCTION public.finalize_order_stock(_order_id uuid)
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
  v_country text;
  v_region text;
  v_city text;
  v_lat numeric;
  v_lng numeric;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng
    INTO o
    FROM public.orders WHERE id = _order_id;

  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region  := o.shipping_address->>'region';
  v_city    := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat     := o.shipping_lat;
  v_lng     := o.shipping_lng;

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items
     WHERE order_id = _order_id
  LOOP
    -- Resolve product_id from slug if missing
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products
       WHERE slug = it.product_slug LIMIT 1;
    END IF;

    IF v_product_id IS NULL THEN CONTINUE; END IF;

    -- Use admin-provided warehouse if set, else pick nearest
    v_warehouse_id := it.warehouse_id;
    IF v_warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng
      );
    END IF;

    -- Decrement inventory if we found a warehouse (trigger keeps products.stock in sync)
    IF v_warehouse_id IS NOT NULL THEN
      UPDATE public.inventory
         SET quantity = GREATEST(0, quantity - it.qty)
       WHERE product_id = v_product_id
         AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND warehouse_id = v_warehouse_id;
    ELSE
      -- Legacy fallback: decrement products.stock directly
      UPDATE public.products
         SET stock = GREATEST(0, stock - it.qty)
       WHERE id = v_product_id;
    END IF;

    UPDATE public.order_items
       SET product_id = v_product_id,
           warehouse_id = v_warehouse_id
     WHERE id = it.id;

    UPDATE public.products
       SET sales_count = COALESCE(sales_count, 0) + it.qty
     WHERE id = v_product_id;
  END LOOP;
END;
$$;

-- 3. Low-stock notification trigger on inventory
CREATE OR REPLACE FUNCTION public.notify_inventory_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available integer;
  v_old_available integer;
  v_pname text;
  v_wname text;
BEGIN
  v_available := NEW.quantity - NEW.reserved_quantity;
  v_old_available := COALESCE(OLD.quantity, 0) - COALESCE(OLD.reserved_quantity, 0);

  IF v_available <= NEW.low_stock_threshold
     AND (TG_OP = 'INSERT' OR v_old_available > OLD.low_stock_threshold) THEN
    SELECT name INTO v_pname FROM public.products WHERE id = NEW.product_id;
    SELECT name INTO v_wname FROM public.warehouses WHERE id = NEW.warehouse_id;

    INSERT INTO public.admin_notifications (
      event_code, severity, title, body, related_entity, related_entity_id, link, metadata
    ) VALUES (
      CASE WHEN v_available <= 0 THEN 'inventory.out_of_stock' ELSE 'inventory.low_stock' END,
      CASE WHEN v_available <= 0 THEN 'critical' ELSE 'warning' END,
      CASE WHEN v_available <= 0
           THEN 'نفاد المخزون: ' || COALESCE(v_pname, '—')
           ELSE 'مخزون منخفض: ' || COALESCE(v_pname, '—') END,
      'الكمية المتاحة ' || v_available || ' في مستودع ' || COALESCE(v_wname, '—'),
      'inventory',
      NEW.id::text,
      '/admin/warehouses',
      jsonb_build_object(
        'product_id', NEW.product_id,
        'variant_id', NEW.variant_id,
        'warehouse_id', NEW.warehouse_id,
        'available', v_available,
        'threshold', NEW.low_stock_threshold
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_low_stock ON public.inventory;
CREATE TRIGGER trg_inventory_low_stock
AFTER INSERT OR UPDATE OF quantity, reserved_quantity, low_stock_threshold
ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.notify_inventory_low_stock();
