-- Decrement per-size stock when an order's stock is finalized.
-- Size variants (product_variants tagged attributes.kind = 'size') track stock
-- on the variant row itself — outside the warehouse `inventory` table — so the
-- existing finalize logic never touched them. We re-create finalize_order_stock
-- with its exact current body and append a set-based decrement that matches the
-- order item's snapshotted SKU to the size variant's SKU.
--
-- Note: size stock is decremented at finalize (i.e. when payment is confirmed /
-- stock is committed), which covers immediate payments and the async-webhook
-- finalize path alike. Unpaid/expired orders are never finalized, so nothing is
-- decremented for them and no restock is required.
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

  -- Per-size stock: decrement the size variant matched by the order item's SKU
  -- (scoped to the same product to be safe against cross-product SKU reuse).
  UPDATE public.product_variants v
     SET stock = GREATEST(0, v.stock - oi.qty)
    FROM public.order_items oi
   WHERE oi.order_id = _order_id
     AND oi.sku IS NOT NULL
     AND v.sku = oi.sku
     AND v.attributes->>'kind' = 'size'
     AND (oi.product_id IS NULL OR v.product_id = oi.product_id);
END;
$$;
