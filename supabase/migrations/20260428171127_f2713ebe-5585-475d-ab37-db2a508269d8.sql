
-- Carriers
CREATE TABLE public.shipping_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  carrier_type text NOT NULL DEFAULT 'local',
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  supports_cod boolean NOT NULL DEFAULT false,
  supports_international boolean NOT NULL DEFAULT false,
  supports_tracking boolean NOT NULL DEFAULT true,
  supports_webhook boolean NOT NULL DEFAULT false,
  api_endpoint text,
  api_credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret_name text,
  default_delivery_days_min integer DEFAULT 1,
  default_delivery_days_max integer DEFAULT 5,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active carriers" ON public.shipping_carriers FOR SELECT TO anon, authenticated
  USING (is_active = true OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admins manage carriers" ON public.shipping_carriers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Zones
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  country_code text NOT NULL DEFAULT 'SA',
  cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  delivery_days_min integer DEFAULT 1,
  delivery_days_max integer DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_zones_carrier ON public.shipping_zones(carrier_id);
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read zones" ON public.shipping_zones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage zones" ON public.shipping_zones FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Rates (rules: weight, value, flat)
CREATE TABLE public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE CASCADE,
  rate_type text NOT NULL DEFAULT 'flat',
  base_fee numeric NOT NULL DEFAULT 0,
  per_kg_fee numeric DEFAULT 0,
  min_weight_kg numeric DEFAULT 0,
  max_weight_kg numeric,
  min_order_value numeric DEFAULT 0,
  max_order_value numeric,
  free_shipping_threshold numeric,
  cod_extra_fee numeric DEFAULT 0,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_rates_zone ON public.shipping_rates(zone_id);
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rates" ON public.shipping_rates FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage rates" ON public.shipping_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Product restrictions
CREATE TABLE public.product_shipping_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  city text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.product_shipping_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read restrictions" ON public.product_shipping_restrictions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage restrictions" ON public.product_shipping_restrictions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Shipments
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text,
  carrier_id uuid REFERENCES public.shipping_carriers(id) ON DELETE SET NULL,
  carrier_code text,
  zone_id uuid REFERENCES public.shipping_zones(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  tracking_number text,
  tracking_url text,
  awb_url text,
  customer_name text,
  customer_phone text,
  customer_email text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  city text,
  country_code text DEFAULT 'SA',
  lat numeric,
  lng numeric,
  weight_kg numeric,
  dimensions jsonb,
  declared_value numeric,
  cod_amount numeric DEFAULT 0,
  shipping_fee numeric DEFAULT 0,
  estimated_delivery_at timestamp with time zone,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  failure_reason text,
  return_reason text,
  is_returned boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  last_polled_at timestamp with time zone,
  raw_response jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_ship_order ON public.shipments(order_id);
CREATE INDEX idx_ship_status ON public.shipments(status);
CREATE INDEX idx_ship_tracking ON public.shipments(tracking_number);
CREATE INDEX idx_ship_carrier ON public.shipments(carrier_id);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own shipments" ON public.shipments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid())
    OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'viewer')
  );
CREATE POLICY "Admins insert shipments" ON public.shipments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admins update shipments" ON public.shipments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Admins delete shipments" ON public.shipments FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Tracking events
CREATE TABLE public.shipment_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  location text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_track_shipment ON public.shipment_tracking_events(shipment_id, occurred_at DESC);
ALTER TABLE public.shipment_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read tracking via shipment" ON public.shipment_tracking_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments s LEFT JOIN orders o ON o.id = s.order_id
      WHERE s.id = shipment_tracking_events.shipment_id
        AND (o.user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'viewer'))
    )
  );
CREATE POLICY "Admins insert tracking" ON public.shipment_tracking_events FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager'));

-- Webhook logs
CREATE TABLE public.shipping_webhooks_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_code text NOT NULL,
  event_type text,
  signature text,
  signature_valid boolean NOT NULL DEFAULT false,
  ip_address text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  related_shipment_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_swh_carrier ON public.shipping_webhooks_log(carrier_code, created_at DESC);
ALTER TABLE public.shipping_webhooks_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read shipping webhook logs" ON public.shipping_webhooks_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Triggers
CREATE TRIGGER touch_carriers_upd BEFORE UPDATE ON public.shipping_carriers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_shipments_upd BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default carriers
INSERT INTO public.shipping_carriers (code, name_ar, name_en, carrier_type, supports_cod, supports_international, default_delivery_days_min, default_delivery_days_max, display_order) VALUES
  ('aramex', 'أرامكس', 'Aramex', 'local', true, true, 1, 3, 1),
  ('smsa', 'سمسا', 'SMSA Express', 'local', true, false, 1, 3, 2),
  ('dhl', 'DHL', 'DHL Express', 'international', false, true, 2, 5, 3),
  ('redbox', 'ريد بوكس', 'RedBox', 'local', true, false, 1, 2, 4),
  ('local_courier', 'مندوب داخلي', 'Internal Courier', 'internal', true, false, 0, 1, 5),
  ('pickup', 'استلام من الفرع', 'Store Pickup', 'pickup', false, false, 0, 0, 6);
