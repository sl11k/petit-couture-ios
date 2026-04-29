-- =================== WEBHOOKS DELIVERY + EVENTS ===================

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id uuid NOT NULL,
  payload jsonb NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  response_body text,
  error_message text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admins read webhook deliveries"
ON public.webhook_deliveries FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "System inserts deliveries" ON public.webhook_deliveries;
CREATE POLICY "System inserts deliveries"
ON public.webhook_deliveries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System updates deliveries" ON public.webhook_deliveries;
CREATE POLICY "System updates deliveries"
ON public.webhook_deliveries FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status) WHERE status IN ('pending','retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON public.webhook_deliveries(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON public.webhook_deliveries(next_retry_at) WHERE status = 'retrying';

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read webhook events" ON public.webhook_events;
CREATE POLICY "Admins read webhook events"
ON public.webhook_events FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "System inserts events" ON public.webhook_events;
CREATE POLICY "System inserts events"
ON public.webhook_events FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON public.webhook_events(created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type, created_at DESC);

-- =================== API KEYS + LOGS ===================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  created_by uuid,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage api keys" ON public.api_keys;
CREATE POLICY "Admins manage api keys"
ON public.api_keys FOR ALL
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS idx_api_keys_active_partial ON public.api_keys(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer,
  ip_address text,
  user_agent text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read api logs" ON public.api_request_logs;
CREATE POLICY "Admins read api logs"
ON public.api_request_logs FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "System inserts api logs" ON public.api_request_logs;
CREATE POLICY "System inserts api logs"
ON public.api_request_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_api_logs_key ON public.api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_path ON public.api_request_logs(path, created_at DESC);

-- =================== EVENT EMITTER + TRIGGERS ===================

CREATE OR REPLACE FUNCTION public.emit_webhook_event(_event_type text, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.webhook_events(event_type, payload)
  VALUES (_event_type, _payload)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_emit_events()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _payload jsonb;
BEGIN
  _payload := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', NEW.order_number,
    'status', NEW.status,
    'payment_status', NEW.payment_status,
    'total', NEW.total,
    'currency', NEW.currency,
    'customer_id', NEW.customer_id,
    'created_at', NEW.created_at
  );
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_webhook_event('order.created', _payload);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      PERFORM public.emit_webhook_event('order.paid', _payload);
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'cancelled' THEN
        PERFORM public.emit_webhook_event('order.cancelled', _payload);
      ELSIF NEW.status = 'shipped' THEN
        PERFORM public.emit_webhook_event('order.shipped', _payload);
      ELSIF NEW.status = 'delivered' THEN
        PERFORM public.emit_webhook_event('order.delivered', _payload);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_emit_events ON public.orders;
CREATE TRIGGER trg_orders_emit_events
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_emit_events();

CREATE OR REPLACE FUNCTION public.products_emit_low_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock
     AND NEW.stock <= COALESCE(NEW.low_stock_threshold, 5)
     AND NEW.stock > 0
     AND (OLD.stock IS NULL OR OLD.stock > COALESCE(NEW.low_stock_threshold, 5)) THEN
    PERFORM public.emit_webhook_event('inventory.low', jsonb_build_object(
      'product_id', NEW.id,
      'sku', NEW.sku,
      'name_ar', NEW.name_ar,
      'name_en', NEW.name_en,
      'stock', NEW.stock,
      'threshold', NEW.low_stock_threshold
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_low_stock ON public.products;
CREATE TRIGGER trg_products_low_stock
AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_emit_low_stock();

CREATE OR REPLACE FUNCTION public.profiles_emit_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_webhook_event('customer.created', jsonb_build_object(
    'customer_id', NEW.user_id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'created_at', NEW.created_at
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_emit_created ON public.profiles;
CREATE TRIGGER trg_profiles_emit_created
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_emit_created();
