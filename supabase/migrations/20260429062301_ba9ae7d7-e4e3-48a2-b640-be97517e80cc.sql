-- ========== Customer Consents ==========
CREATE TABLE IF NOT EXISTS public.customer_consents (
  user_id uuid PRIMARY KEY,
  marketing_email boolean NOT NULL DEFAULT false,
  marketing_sms boolean NOT NULL DEFAULT false,
  marketing_whatsapp boolean NOT NULL DEFAULT false,
  marketing_push boolean NOT NULL DEFAULT false,
  transactional_email boolean NOT NULL DEFAULT true,
  transactional_sms boolean NOT NULL DEFAULT true,
  data_processing boolean NOT NULL DEFAULT true,
  third_party_sharing boolean NOT NULL DEFAULT false,
  source text,
  ip_address text,
  consent_version text DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consents readable by owner or admin"
  ON public.customer_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing_manager'));

CREATE POLICY "Consents insertable by owner"
  ON public.customer_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Consents updatable by owner or super_admin"
  ON public.customer_consents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));

-- ========== Unsubscribe Tokens (public, no login required) ==========
CREATE TABLE IF NOT EXISTS public.unsubscribe_tokens (
  token text PRIMARY KEY,
  user_id uuid,
  email text,
  channel text NOT NULL DEFAULT 'email',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tokens readable by anyone"
  ON public.unsubscribe_tokens FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Tokens updatable by anyone"
  ON public.unsubscribe_tokens FOR UPDATE TO anon, authenticated
  USING (used_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tokens insertable by admins"
  ON public.unsubscribe_tokens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing_manager'));

-- ========== Data Export Requests ==========
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  download_url text,
  expires_at timestamptz,
  notes text
);
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exports readable by owner or admin"
  ON public.data_export_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Exports insertable by owner"
  ON public.data_export_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Exports updatable by admin"
  ON public.data_export_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- ========== Account Deletion Requests ==========
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  processed_by uuid
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deletion req readable by owner or admin"
  ON public.account_deletion_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Deletion req insertable by owner"
  ON public.account_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deletion req updatable by owner or super_admin"
  ON public.account_deletion_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));

-- ========== Cookie Consent Log ==========
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text,
  user_id uuid,
  necessary boolean NOT NULL DEFAULT true,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  preferences boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  consent_version text DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cookie consents insertable by anyone"
  ON public.cookie_consents FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Cookie consents readable by admins"
  ON public.cookie_consents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- ========== PII masking helpers ==========
CREATE OR REPLACE FUNCTION public.mask_email(_email text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _email IS NULL OR _email = '' THEN _email
    WHEN position('@' in _email) < 3 THEN '***' || substring(_email from position('@' in _email))
    ELSE substring(_email from 1 for 2) || '***' || substring(_email from position('@' in _email))
  END;
$$;

CREATE OR REPLACE FUNCTION public.mask_phone(_phone text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _phone IS NULL OR length(_phone) < 4 THEN _phone
    ELSE repeat('*', length(_phone) - 4) || right(_phone, 4)
  END;
$$;

-- ========== Profiles safe view (PII masked for general staff) ==========
-- Security definer function: returns full or masked profile based on caller permission
CREATE OR REPLACE FUNCTION public.get_profile_safe(_user_id uuid)
RETURNS TABLE(
  user_id uuid, email text, full_name text, phone text, created_at timestamptz, masked boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_view_pii boolean;
BEGIN
  can_view_pii := public.has_role(auth.uid(),'super_admin')
               OR public.has_role(auth.uid(),'admin')
               OR public.has_permission(auth.uid(),'customers.view_pii');

  RETURN QUERY
  SELECT p.user_id,
         CASE WHEN can_view_pii THEN p.email ELSE public.mask_email(p.email) END,
         p.full_name,
         CASE WHEN can_view_pii THEN p.phone ELSE public.mask_phone(p.phone) END,
         p.created_at,
         NOT can_view_pii AS masked
  FROM public.profiles p
  WHERE p.user_id = _user_id;
END;
$$;

-- Touch updated_at on consents
DROP TRIGGER IF EXISTS trg_consents_touch ON public.customer_consents;
CREATE TRIGGER trg_consents_touch BEFORE UPDATE ON public.customer_consents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();