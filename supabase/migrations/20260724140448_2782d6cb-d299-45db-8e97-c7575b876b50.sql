
-- 1) reserve_order_inventory: also decrement product_variants.stock
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
  v_already_reserved boolean;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng, stock_reserved_at
    INTO o
    FROM public.orders WHERE id = _order_id FOR UPDATE;
  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region  := o.shipping_address->>'region';
  v_city    := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat     := o.shipping_lat;
  v_lng     := o.shipping_lng;
  v_already_reserved := (o.stock_reserved_at IS NOT NULL);

  FOR it IN
    SELECT id, product_slug, product_id, variant_id, warehouse_id, qty
      FROM public.order_items WHERE order_id = _order_id
  LOOP
    v_product_id := it.product_id;
    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = it.product_slug LIMIT 1;
    END IF;
    IF v_product_id IS NULL THEN CONTINUE; END IF;

    IF it.warehouse_id IS NULL THEN
      v_warehouse_id := public.pick_warehouse_for_item(
        v_product_id, it.variant_id, it.qty, v_country, v_region, v_city, v_lat, v_lng
      );
      IF v_warehouse_id IS NOT NULL THEN
        UPDATE public.inventory
           SET reserved_quantity = reserved_quantity + it.qty
         WHERE product_id = v_product_id
           AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
               = COALESCE(it.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND warehouse_id = v_warehouse_id;
        UPDATE public.order_items
           SET product_id = v_product_id, warehouse_id = v_warehouse_id
         WHERE id = it.id;
      ELSE
        UPDATE public.order_items SET product_id = v_product_id WHERE id = it.id;
      END IF;
    END IF;

    IF NOT v_already_reserved THEN
      UPDATE public.products
         SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
       WHERE id = v_product_id;

      IF it.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
         WHERE id = it.variant_id;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_already_reserved THEN
    UPDATE public.orders SET stock_reserved_at = now() WHERE id = _order_id;
  END IF;
END;
$function$;

-- 2) finalize_order_stock: also decrement product_variants.stock when not already reserved
CREATE OR REPLACE FUNCTION public.finalize_order_stock(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  it RECORD; o RECORD;
  v_product_id uuid; v_warehouse_id uuid;
  v_country text; v_region text; v_city text;
  v_lat numeric; v_lng numeric;
  v_was_reserved boolean;
  v_already_reserved_order boolean;
BEGIN
  SELECT shipping_address, shipping_lat, shipping_lng, stock_reserved_at
    INTO o
    FROM public.orders WHERE id = _order_id FOR UPDATE;
  v_country := COALESCE(o.shipping_address->>'country_code', o.shipping_address->>'country', 'SA');
  v_region  := o.shipping_address->>'region';
  v_city    := COALESCE(o.shipping_address->>'city', o.shipping_address->>'district');
  v_lat     := o.shipping_lat;
  v_lng     := o.shipping_lng;
  v_already_reserved_order := (o.stock_reserved_at IS NOT NULL);

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
        UPDATE public.inventory
           SET reserved_quantity = GREATEST(0, reserved_quantity - it.qty),
               quantity = GREATEST(0, quantity - it.qty)
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
        UPDATE public.order_items
           SET product_id = v_product_id, warehouse_id = v_warehouse_id
         WHERE id = it.id;
      END IF;
    END IF;

    IF NOT v_already_reserved_order THEN
      UPDATE public.products
         SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
       WHERE id = v_product_id;

      IF it.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
           SET stock = GREATEST(0, COALESCE(stock, 0) - it.qty)
         WHERE id = it.variant_id;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_already_reserved_order THEN
    UPDATE public.orders SET stock_reserved_at = now() WHERE id = _order_id;
  END IF;
END;
$function$;

-- 3) release_order_inventory: restore product_variants.stock too
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
BEGIN
  SELECT stock_reserved_at, payment_stock_finalized_at
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

    IF it.warehouse_id IS NOT NULL AND v_product_id IS NOT NULL THEN
      UPDATE public.inventory
         SET reserved_quantity = GREATEST(0, reserved_quantity - it.qty)
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

-- 4) Allow guests to keep updating their own abandoned cart snapshot
DROP POLICY IF EXISTS "Owners or staff update carts" ON public.abandoned_carts;
CREATE POLICY "Owners guests or staff update carts"
ON public.abandoned_carts FOR UPDATE
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.uid() IS NULL AND user_id IS NULL)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.uid() IS NULL AND user_id IS NULL)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);
