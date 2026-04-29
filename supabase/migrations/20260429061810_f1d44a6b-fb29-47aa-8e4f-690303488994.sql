-- ===== Security Settings (singleton) =====
CREATE TABLE IF NOT EXISTS public.security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  -- Password policy
  password_min_length integer NOT NULL DEFAULT 10,
  password_require_uppercase boolean NOT NULL DEFAULT true,
  password_require_lowercase boolean NOT NULL DEFAULT true,
  password_require_number boolean NOT NULL DEFAULT true,
  password_require_symbol boolean NOT NULL DEFAULT false,
  password_max_age_days integer NOT NULL DEFAULT 90,
  password_history_count integer NOT NULL DEFAULT 5,
  -- Account lockout
  lockout_max_attempts integer NOT NULL DEFAULT 5,
  lockout_window_minutes integer NOT NULL DEFAULT 15,
  lockout_duration_minutes integer NOT NULL DEFAULT 30,
  -- Session
  session_idle_timeout_minutes integer NOT NULL DEFAULT 60,
  session_absolute_timeout_hours integer NOT NULL DEFAULT 24,
  session_single_device boolean NOT NULL DEFAULT false,
  -- 2FA
  require_2fa_for_admins boolean NOT NULL DEFAULT true,
  require_2fa_for_managers boolean NOT NULL DEFAULT false,
  -- Rate limiting
  api_rate_limit_per_minute integer NOT NULL DEFAULT 60,
  -- Backup
  backup_enabled boolean NOT NULL DEFAULT true,
  backup_frequency text NOT NULL DEFAULT 'daily',
  backup_retention_days integer NOT NULL DEFAULT 30,
  last_backup_at timestamptz,
  -- Misc
  force_https boolean NOT NULL DEFAULT true,
  enable_csrf_protection boolean NOT NULL DEFAULT true,
  enable_xss_protection boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security settings readable by admins"
  ON public.security_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Security settings updatable by super_admin"
  ON public.security_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Security settings insertable by super_admin"
  ON public.security_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.security_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ===== Account Lockouts =====
CREATE TABLE IF NOT EXISTS public.account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  locked_until timestamptz NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lockouts_email ON public.account_lockouts(email, locked_until DESC);
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lockouts readable by admins"
  ON public.account_lockouts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Lockouts insertable by anyone"
  ON public.account_lockouts FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Lockouts updatable by admins"
  ON public.account_lockouts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- ===== Two-Factor Authentication =====
CREATE TABLE IF NOT EXISTS public.user_2fa (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  secret_encrypted text,
  backup_codes_hash text[],
  enrolled_at timestamptz,
  last_used_at timestamptz,
  recovery_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "2FA readable by owner or admin"
  ON public.user_2fa FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "2FA upsertable by owner"
  ON public.user_2fa FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "2FA updatable by owner or super_admin"
  ON public.user_2fa FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "2FA deletable by owner or super_admin"
  ON public.user_2fa FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));

-- ===== Active Sessions =====
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_label text,
  ip_address text,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.active_sessions(user_id, last_seen_at DESC);
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions readable by owner or admin"
  ON public.active_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Sessions insertable by owner"
  ON public.active_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sessions updatable by owner or super_admin"
  ON public.active_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));

-- ===== Password History =====
CREATE TABLE IF NOT EXISTS public.password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pwd_history_user ON public.password_history(user_id, created_at DESC);
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Password history readable by owner"
  ON public.password_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Password history insertable by owner"
  ON public.password_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ===== Backup Log =====
CREATE TABLE IF NOT EXISTS public.backup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  size_bytes bigint,
  location text,
  notes text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backup log readable by admins"
  ON public.backup_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Backup log insertable by admins"
  ON public.backup_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- ===== Helper: check & register failed login =====
CREATE OR REPLACE FUNCTION public.check_account_lockout(_email text)
RETURNS TABLE (locked boolean, locked_until timestamptz, remaining_attempts integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  active_lock RECORD;
  recent_failures integer;
BEGIN
  SELECT * INTO s FROM public.security_settings WHERE id = true;
  IF s IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 5;
    RETURN;
  END IF;

  SELECT * INTO active_lock FROM public.account_lockouts
   WHERE email = _email AND locked_until > now() AND released_at IS NULL
   ORDER BY locked_until DESC LIMIT 1;

  IF active_lock IS NOT NULL THEN
    RETURN QUERY SELECT true, active_lock.locked_until, 0;
    RETURN;
  END IF;

  SELECT count(*) INTO recent_failures
    FROM public.failed_login_attempts
   WHERE email = _email
     AND created_at > now() - (s.lockout_window_minutes || ' minutes')::interval;

  RETURN QUERY SELECT false, NULL::timestamptz, GREATEST(0, s.lockout_max_attempts - recent_failures);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_failed_login(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  recent_failures integer;
BEGIN
  SELECT * INTO s FROM public.security_settings WHERE id = true;
  IF s IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO recent_failures
    FROM public.failed_login_attempts
   WHERE email = _email
     AND created_at > now() - (s.lockout_window_minutes || ' minutes')::interval;

  IF recent_failures >= s.lockout_max_attempts THEN
    INSERT INTO public.account_lockouts (email, locked_until, failed_count, reason)
    VALUES (_email, now() + (s.lockout_duration_minutes || ' minutes')::interval, recent_failures,
            'Too many failed login attempts');
  END IF;
END;
$$;