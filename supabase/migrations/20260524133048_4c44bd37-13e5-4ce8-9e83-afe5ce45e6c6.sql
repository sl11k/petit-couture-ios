
-- Extend existing product_variants with new columns (table already exists)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS price_override numeric(12,2),
  ADD COLUMN IF NOT EXISTS compare_at_price_override numeric(12,2),
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.product_option_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pot_product ON public.product_option_types(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pot_product_name ON public.product_option_types(product_id, lower(name));

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type_id uuid NOT NULL REFERENCES public.product_option_types(id) ON DELETE CASCADE,
  value text NOT NULL,
  value_en text,
  hex_color text,
  image_url text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pov_type ON public.product_option_values(option_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pov_type_value ON public.product_option_values(option_type_id, lower(value));

CREATE TABLE IF NOT EXISTS public.variant_option_values (
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, option_value_id)
);
CREATE INDEX IF NOT EXISTS idx_vov_variant ON public.variant_option_values(variant_id);
CREATE INDEX IF NOT EXISTS idx_vov_value ON public.variant_option_values(option_value_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_variant_id_fkey' AND table_name='inventory'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_oi_variant ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_oi_warehouse ON public.order_items(warehouse_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pot_updated_at') THEN
    CREATE TRIGGER trg_pot_updated_at BEFORE UPDATE ON public.product_option_types
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pov_updated_at') THEN
    CREATE TRIGGER trg_pov_updated_at BEFORE UPDATE ON public.product_option_values
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

ALTER TABLE public.product_option_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_option_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pot_public_read" ON public.product_option_types;
CREATE POLICY "pot_public_read" ON public.product_option_types FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_active = true));

DROP POLICY IF EXISTS "pot_admin_all" ON public.product_option_types;
CREATE POLICY "pot_admin_all" ON public.product_option_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "pov_public_read" ON public.product_option_values;
CREATE POLICY "pov_public_read" ON public.product_option_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.product_option_types pot
    JOIN public.products p ON p.id = pot.product_id
    WHERE pot.id = option_type_id AND p.is_active = true
  ));

DROP POLICY IF EXISTS "pov_admin_all" ON public.product_option_values;
CREATE POLICY "pov_admin_all" ON public.product_option_values FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "vov_public_read" ON public.variant_option_values;
CREATE POLICY "vov_public_read" ON public.variant_option_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = variant_id AND v.is_active = true AND p.is_active = true
  ));

DROP POLICY IF EXISTS "vov_admin_all" ON public.variant_option_values;
CREATE POLICY "vov_admin_all" ON public.variant_option_values FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.get_product_variants_with_stock(_product_id uuid)
RETURNS TABLE(
  variant_id uuid,
  sku text,
  price_override numeric,
  compare_at_price_override numeric,
  image_url text,
  is_active boolean,
  sort_order integer,
  attributes jsonb,
  option_values jsonb,
  available_quantity bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id AS variant_id,
    v.sku,
    v.price_override,
    v.compare_at_price_override,
    v.image_url,
    v.is_active,
    v.position AS sort_order,
    v.attributes,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'option_value_id', pov.id,
        'option_type_id', pot.id,
        'type_name', pot.name,
        'type_name_en', pot.name_en,
        'value', pov.value,
        'value_en', pov.value_en,
        'hex_color', pov.hex_color,
        'image_url', pov.image_url
      ) ORDER BY pot.position, pov.position)
      FROM public.variant_option_values vov
      JOIN public.product_option_values pov ON pov.id = vov.option_value_id
      JOIN public.product_option_types pot ON pot.id = pov.option_type_id
      WHERE vov.variant_id = v.id
    ), '[]'::jsonb) AS option_values,
    COALESCE((
      SELECT SUM(GREATEST(0, i.quantity - i.reserved_quantity))
      FROM public.inventory i
      JOIN public.warehouses w ON w.id = i.warehouse_id
      WHERE i.variant_id = v.id AND i.status='active' AND w.status='active'
    ), 0) AS available_quantity
  FROM public.product_variants v
  WHERE v.product_id = _product_id
  ORDER BY v.position, v.created_at;
$$;
