-- admin_notifications: staff only can create
DROP POLICY IF EXISTS "Authenticated insert admin notifications" ON public.admin_notifications;
CREATE POLICY "Staff insert admin notifications" ON public.admin_notifications
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
);

-- audit_logs: only self-attributed entries
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_logs;
CREATE POLICY "Self attributed audit insert" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- campaign_events: marketing/admin only
DROP POLICY IF EXISTS "Authenticated insert campaign events" ON public.campaign_events;
CREATE POLICY "Marketing insert campaign events" ON public.campaign_events
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'marketing_manager'::app_role)
);

-- notification_log: staff, or self-addressed
DROP POLICY IF EXISTS "Authenticated insert log" ON public.notification_log;
CREATE POLICY "Staff or self insert notification log" ON public.notification_log
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  OR recipient_user_id = auth.uid()
);

-- idempotency_keys: cannot claim another user's identity
DROP POLICY IF EXISTS "anyone_insert_idem" ON public.idempotency_keys;
CREATE POLICY "insert_own_or_guest_idem" ON public.idempotency_keys
FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());