CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  provider text NOT NULL,
  display_name text,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox',
  api_key text,
  api_secret text,
  webhook_url text,
  webhook_secret text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, provider)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged read integrations"
  ON public.integrations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'integrations.manage')
  );

CREATE POLICY "Privileged write integrations"
  ON public.integrations FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'integrations.manage')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'integrations.manage')
  );

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER audit_integrations
  AFTER INSERT OR UPDATE OR DELETE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Outgoing webhook endpoints (for external systems to receive our events)
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  events text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  last_delivery_status integer,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged manage webhooks"
  ON public.webhook_endpoints FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'integrations.manage')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'integrations.manage')
  );

CREATE TRIGGER webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();