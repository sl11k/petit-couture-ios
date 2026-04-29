CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  category text NOT NULL DEFAULT 'system',
  message_customer text,
  message_admin text NOT NULL,
  suggested_action text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  order_id uuid,
  url text,
  user_agent text,
  ip_address text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_code ON public.error_logs (code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON public.error_logs (resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON public.error_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_order ON public.error_logs (order_id, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_insert_errors" ON public.error_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admins_read_errors" ON public.error_logs
  FOR SELECT USING (
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'manager') OR
    public.has_role(auth.uid(),'staff')
  );

CREATE POLICY "admins_update_errors" ON public.error_logs
  FOR UPDATE USING (
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'manager')
  );

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  scope text NOT NULL,
  user_id uuid,
  result jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_insert_idem" ON public.idempotency_keys
  FOR INSERT WITH CHECK (true);
CREATE POLICY "owner_select_idem" ON public.idempotency_keys
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner_update_idem" ON public.idempotency_keys
  FOR UPDATE USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));