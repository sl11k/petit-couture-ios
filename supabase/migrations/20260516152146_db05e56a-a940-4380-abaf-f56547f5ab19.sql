
-- ============== Customer Addresses ==============
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  full_name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  district text,
  street text,
  postal_code text,
  building_number text,
  additional_number text,
  notes text,
  lat numeric(10,7),
  lng numeric(10,7),
  geo_address text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON public.customer_addresses(user_id);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own addresses" ON public.customer_addresses;
CREATE POLICY "Users view own addresses" ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Users insert own addresses" ON public.customer_addresses;
CREATE POLICY "Users insert own addresses" ON public.customer_addresses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own addresses" ON public.customer_addresses;
CREATE POLICY "Users update own addresses" ON public.customer_addresses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own addresses" ON public.customer_addresses;
CREATE POLICY "Users delete own addresses" ON public.customer_addresses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_customer_addresses_updated
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enforce single default address per user
CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_address
AFTER INSERT OR UPDATE OF is_default ON public.customer_addresses
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.enforce_single_default_address();

-- ============== Order finalize: link product_id + decrement stock ==============
CREATE OR REPLACE FUNCTION public.finalize_order_stock(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
  v_product_id uuid;
BEGIN
  FOR it IN
    SELECT id, product_slug, qty FROM public.order_items
    WHERE order_id = _order_id
  LOOP
    SELECT id INTO v_product_id
      FROM public.products
     WHERE slug = it.product_slug
     LIMIT 1;

    IF v_product_id IS NOT NULL THEN
      UPDATE public.order_items
         SET product_id = v_product_id
       WHERE id = it.id AND product_id IS NULL;

      UPDATE public.products
         SET stock = GREATEST(0, stock - it.qty),
             sales_count = sales_count + it.qty
       WHERE id = v_product_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_order_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_stock(uuid) TO service_role;
