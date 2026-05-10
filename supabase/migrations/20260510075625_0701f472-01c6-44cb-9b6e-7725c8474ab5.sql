
CREATE TABLE IF NOT EXISTS public.oto_webhook_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type text NOT NULL,
  endpoint_url text NOT NULL,
  oto_webhook_id text,
  status text NOT NULL DEFAULT 'pending',
  request_body jsonb,
  response jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_registered_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_oto_webhook_reg_type ON public.oto_webhook_registrations(webhook_type);

ALTER TABLE public.oto_webhook_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage oto webhook registrations"
ON public.oto_webhook_registrations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.oto_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type text NOT NULL DEFAULT 'unknown',
  order_id text,
  tracking_number text,
  status_value text,
  error_code text,
  raw jsonb NOT NULL,
  signature_present boolean NOT NULL DEFAULT false,
  signature_valid boolean NOT NULL DEFAULT false,
  auth_present boolean NOT NULL DEFAULT false,
  auth_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  http_status integer,
  ip_address text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oto_deliv_received ON public.oto_webhook_deliveries(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_oto_deliv_order ON public.oto_webhook_deliveries(order_id);

ALTER TABLE public.oto_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read oto webhook deliveries"
ON public.oto_webhook_deliveries
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
