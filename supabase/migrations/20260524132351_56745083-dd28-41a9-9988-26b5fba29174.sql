
-- ========================================
-- Phase 1: Warehouses + Inventory
-- ========================================

-- 1) warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_en text,
  country_code text DEFAULT 'SA',
  region text,
  city text,
  address text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  priority integer NOT NULL DEFAULT 100,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_status ON public.warehouses(status);
CREATE INDEX IF NOT EXISTS idx_warehouses_country ON public.warehouses(country_code);

DROP TRIGGER IF EXISTS trg_warehouses_touch ON public.warehouses;
CREATE TRIGGER trg_warehouses_touch
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_public_read_active" ON public.warehouses;
CREATE POLICY "warehouses_public_read_active" ON public.warehouses
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "warehouses_admin_read_all" ON public.warehouses;
CREATE POLICY "warehouses_admin_read_all" ON public.warehouses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "warehouses_admin_write" ON public.warehouses;
CREATE POLICY "warehouses_admin_write" ON public.warehouses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));


-- 2) inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid, -- nullable in Phase 1; FK added in Phase 2
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  sku text,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (product, variant, warehouse). Use COALESCE to treat NULL variant as a single bucket.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inventory_pvw
  ON public.inventory(product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON public.inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON public.inventory(warehouse_id) WHERE quantity <= low_stock_threshold;

DROP TRIGGER IF EXISTS trg_inventory_touch ON public.inventory;
CREATE TRIGGER trg_inventory_touch
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Public read: only show inventory rows tied to active warehouses (no SKUs leaked to anon)
DROP POLICY IF EXISTS "inventory_public_read_active" ON public.inventory;
CREATE POLICY "inventory_public_read_active" ON public.inventory
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = inventory.warehouse_id AND w.status = 'active')
  );

DROP POLICY IF EXISTS "inventory_admin_read_all" ON public.inventory;
CREATE POLICY "inventory_admin_read_all" ON public.inventory
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "inventory_admin_write" ON public.inventory;
CREATE POLICY "inventory_admin_write" ON public.inventory
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));


-- 3) Sync products.stock from inventory totals
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid;
  _total integer;
BEGIN
  _pid := COALESCE(NEW.product_id, OLD.product_id);
  IF _pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(GREATEST(0, i.quantity - i.reserved_quantity)), 0)
    INTO _total
  FROM public.inventory i
  JOIN public.warehouses w ON w.id = i.warehouse_id
  WHERE i.product_id = _pid
    AND i.status = 'active'
    AND w.status = 'active';

  UPDATE public.products SET stock = _total WHERE id = _pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_sync_stock ON public.inventory;
CREATE TRIGGER trg_inventory_sync_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock_from_inventory();


-- 4) Seed default warehouse + backfill inventory for existing products
INSERT INTO public.warehouses (code, name, name_en, country_code, status, priority, notes)
VALUES ('MAIN', 'المستودع الرئيسي', 'Main Warehouse', 'SA', 'active', 1,
        'Auto-created during multi-warehouse migration. Holds all pre-existing product stock.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.inventory (product_id, warehouse_id, sku, quantity, low_stock_threshold, status)
SELECT
  p.id,
  (SELECT id FROM public.warehouses WHERE code = 'MAIN' LIMIT 1),
  p.sku,
  COALESCE(p.stock, 0),
  COALESCE(p.low_stock_threshold, 5),
  'active'
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory i
  WHERE i.product_id = p.id
    AND i.warehouse_id = (SELECT id FROM public.warehouses WHERE code = 'MAIN' LIMIT 1)
);


-- 5) Admin stats RPC
CREATE OR REPLACE FUNCTION public.get_warehouse_stats()
RETURNS TABLE(
  warehouse_id uuid,
  product_count bigint,
  total_quantity bigint,
  reserved_quantity bigint,
  available_quantity bigint,
  low_stock_count bigint,
  out_of_stock_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id AS warehouse_id,
    COUNT(DISTINCT i.product_id) AS product_count,
    COALESCE(SUM(i.quantity), 0) AS total_quantity,
    COALESCE(SUM(i.reserved_quantity), 0) AS reserved_quantity,
    COALESCE(SUM(GREATEST(0, i.quantity - i.reserved_quantity)), 0) AS available_quantity,
    COUNT(*) FILTER (WHERE i.status='active' AND i.quantity > 0 AND i.quantity <= i.low_stock_threshold) AS low_stock_count,
    COUNT(*) FILTER (WHERE i.status='active' AND i.quantity = 0) AS out_of_stock_count
  FROM public.warehouses w
  LEFT JOIN public.inventory i ON i.warehouse_id = w.id
  GROUP BY w.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_stats() TO authenticated;
