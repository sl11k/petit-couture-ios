-- 2) Permission keys table (granular)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only super_admin manages permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- 3) has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND (rp.permission = _permission OR rp.permission = '*')
  ) OR public.has_role(_user_id, 'super_admin') OR public.has_role(_user_id, 'admin');
$$;

-- 4) Seed default permissions for each role
INSERT INTO public.role_permissions (role, permission) VALUES
  -- Super Admin: wildcard
  ('super_admin', '*'),
  ('admin', '*'),
  -- Store Manager
  ('store_manager', 'orders.view'),
  ('store_manager', 'orders.edit'),
  ('store_manager', 'orders.cancel'),
  ('store_manager', 'orders.refund'),
  ('store_manager', 'orders.create_manual'),
  ('store_manager', 'orders.manual_discount'),
  ('store_manager', 'products.manage'),
  ('store_manager', 'inventory.manage'),
  ('store_manager', 'customers.manage'),
  ('store_manager', 'coupons.manage'),
  ('store_manager', 'reports.view'),
  ('store_manager', 'storefront.manage'),
  ('store_manager', 'finance.view'),
  -- Orders Manager
  ('orders_manager', 'orders.view'),
  ('orders_manager', 'orders.edit'),
  ('orders_manager', 'orders.cancel'),
  ('orders_manager', 'orders.refund'),
  ('orders_manager', 'orders.create_manual'),
  ('orders_manager', 'orders.manual_discount'),
  ('orders_manager', 'customers.view'),
  ('orders_manager', 'reports.view'),
  -- Customer Support
  ('support', 'orders.view'),
  ('support', 'orders.edit'),
  ('support', 'customers.view'),
  ('support', 'customers.manage'),
  ('support', 'returns.manage'),
  -- Inventory Manager
  ('inventory_manager', 'products.manage'),
  ('inventory_manager', 'inventory.manage'),
  ('inventory_manager', 'reports.view'),
  -- Marketing Manager
  ('marketing_manager', 'coupons.manage'),
  ('marketing_manager', 'storefront.manage'),
  ('marketing_manager', 'reports.view'),
  ('marketing_manager', 'customers.view'),
  ('marketing_manager', 'customers.export'),
  -- Finance Manager
  ('finance_manager', 'finance.view'),
  ('finance_manager', 'finance.payment_settings'),
  ('finance_manager', 'finance.shipping_settings'),
  ('finance_manager', 'orders.view'),
  ('finance_manager', 'orders.refund'),
  ('finance_manager', 'reports.view'),
  ('finance_manager', 'invoices.manage'),
  -- Content Manager
  ('content_manager', 'storefront.manage'),
  ('content_manager', 'products.manage'),
  -- Viewer
  ('viewer', 'orders.view'),
  ('viewer', 'customers.view'),
  ('viewer', 'reports.view'),
  ('viewer', 'finance.view'),
  -- Developer
  ('developer', 'integrations.manage'),
  ('developer', 'reports.view'),
  ('developer', 'audit.view'),
  -- Manager (legacy)
  ('manager', 'orders.view'),
  ('manager', 'orders.edit'),
  ('manager', 'products.manage'),
  ('manager', 'customers.manage'),
  ('manager', 'reports.view'),
  -- Staff (legacy)
  ('staff', 'orders.view'),
  ('staff', 'orders.edit'),
  ('staff', 'products.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- 5) Extend audit_logs with old/new data and IP
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- 6) PREVENT DELETE/UPDATE on audit_logs entirely (immutable log)
DROP POLICY IF EXISTS "No update audit" ON public.audit_logs;
DROP POLICY IF EXISTS "No delete audit" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
DROP TRIGGER IF EXISTS audit_logs_no_delete ON public.audit_logs;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- Allow super_admin/developer to read audit
DROP POLICY IF EXISTS "Admins read audit" ON public.audit_logs;
CREATE POLICY "Privileged read audit"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'audit.view')
  );