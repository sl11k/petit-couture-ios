-- 1) Failed login attempts table
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip_address text,
  user_agent text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_failed_login_email ON public.failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_created ON public.failed_login_attempts(created_at DESC);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert failed login" ON public.failed_login_attempts;
CREATE POLICY "Anyone can insert failed login"
  ON public.failed_login_attempts FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Privileged read failed login" ON public.failed_login_attempts;
CREATE POLICY "Privileged read failed login"
  ON public.failed_login_attempts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'developer')
    OR public.has_permission(auth.uid(), 'audit.view')
  );

-- Block update/delete on failed_login_attempts (immutable)
DROP TRIGGER IF EXISTS failed_login_no_update ON public.failed_login_attempts;
DROP TRIGGER IF EXISTS failed_login_no_delete ON public.failed_login_attempts;
CREATE TRIGGER failed_login_no_update BEFORE UPDATE ON public.failed_login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();
CREATE TRIGGER failed_login_no_delete BEFORE DELETE ON public.failed_login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- 2) Helper to log an audit event from anywhere
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _old_data jsonb DEFAULT NULL,
  _new_data jsonb DEFAULT NULL,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_logs(actor_id, actor_email, action, entity, entity_id, metadata, old_data, new_data, ip_address, user_agent)
  VALUES (auth.uid(), _email, _action, _entity, _entity_id, COALESCE(_metadata,'{}'::jsonb), _old_data, _new_data, _ip, _ua)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- 3) Generic trigger function to audit table changes (orders/products/coupons)
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _action text;
  _entity text := TG_TABLE_NAME;
  _entity_id text;
  _old jsonb;
  _new jsonb;
  _email text;
  _changed jsonb := '{}'::jsonb;
  k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := _entity || '.create';
    _new := to_jsonb(NEW);
    _entity_id := COALESCE((_new->>'id'), NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _entity_id := COALESCE((_new->>'id'), NULL);
    -- compute diff (changed fields only)
    FOR k IN SELECT jsonb_object_keys(_new) LOOP
      IF (_old->k) IS DISTINCT FROM (_new->k) AND k NOT IN ('updated_at','search_vector') THEN
        _changed := _changed || jsonb_build_object(k, jsonb_build_object('old', _old->k, 'new', _new->k));
      END IF;
    END LOOP;
    -- skip if nothing meaningful changed
    IF _changed = '{}'::jsonb THEN RETURN NEW; END IF;

    -- specialized actions
    IF _entity = 'orders' THEN
      IF (_old->>'status') IS DISTINCT FROM (_new->>'status') THEN
        _action := 'order.status_change';
      ELSIF (_old->>'payment_status') IS DISTINCT FROM (_new->>'payment_status') AND (_new->>'payment_status') = 'refunded' THEN
        _action := 'order.refund';
      ELSE
        _action := 'order.update';
      END IF;
    ELSIF _entity = 'products' THEN
      IF (_old->>'price') IS DISTINCT FROM (_new->>'price') THEN
        _action := 'product.price_change';
      ELSIF (_old->>'stock') IS DISTINCT FROM (_new->>'stock') THEN
        _action := 'product.stock_change';
      ELSE
        _action := 'product.update';
      END IF;
    ELSE
      _action := _entity || '.update';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _action := _entity || '.delete';
    _old := to_jsonb(OLD);
    _entity_id := COALESCE((_old->>'id'), NULL);
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs(actor_id, actor_email, action, entity, entity_id, old_data, new_data, metadata)
  VALUES (
    auth.uid(), _email, _action, _entity, _entity_id, _old, _new,
    CASE WHEN _changed = '{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('changed_fields', _changed) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Attach triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_products ON public.products;
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_coupons ON public.coupons;
CREATE TRIGGER audit_coupons
  AFTER INSERT OR UPDATE OR DELETE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();