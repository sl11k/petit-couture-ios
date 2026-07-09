
-- =========================================================================
-- NOTIFICATION INFRASTRUCTURE — FOUNDATION
-- =========================================================================

-- 1) Providers registry -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,              -- 'wasender' | 'meta_cloud' | 'twilio' | 'custom'
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'sms' | 'email' | 'push' | 'telegram'
  is_enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb, -- describes fields the UI should render
  version text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_providers TO authenticated;
GRANT ALL ON public.notif_providers TO service_role;
ALTER TABLE public.notif_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_providers_admin_all ON public.notif_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 2) Provider credentials (encrypted at rest via server-side encryption) ----
CREATE TABLE IF NOT EXISTS public.notif_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.notif_providers(id) ON DELETE CASCADE,
  api_url text,
  api_key_encrypted text,           -- app-layer encrypted; never returned to client raw
  instance_id text,
  session_name text,
  phone_number_id text,
  webhook_secret_encrypted text,
  timeout_ms integer NOT NULL DEFAULT 15000,
  retry_attempts integer NOT NULL DEFAULT 3,
  retry_delay_ms integer NOT NULL DEFAULT 5000,
  ssl_verify boolean NOT NULL DEFAULT true,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb, -- provider-specific fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_provider_credentials TO authenticated;
GRANT ALL ON public.notif_provider_credentials TO service_role;
ALTER TABLE public.notif_provider_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_provider_credentials_admin_all ON public.notif_provider_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 3) Provider health / status snapshot --------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.notif_providers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unknown', -- healthy | degraded | down | unknown
  session_status text,
  instance_status text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  avg_response_ms integer,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_provider_health TO authenticated;
GRANT ALL ON public.notif_provider_health TO service_role;
ALTER TABLE public.notif_provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_provider_health_admin_all ON public.notif_provider_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 4) Event types catalog ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,        -- 'order.created', 'order.paid', ...
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  audience text NOT NULL DEFAULT 'customer', -- customer | admin | both
  category text NOT NULL DEFAULT 'orders',
  is_enabled boolean NOT NULL DEFAULT true,
  delay_seconds integer NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 5, -- 1 highest .. 10 lowest
  respect_working_hours boolean NOT NULL DEFAULT false,
  duplicate_window_seconds integer NOT NULL DEFAULT 60,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  supported_variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_event_types TO authenticated;
GRANT ALL ON public.notif_event_types TO service_role;
ALTER TABLE public.notif_event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_event_types_admin_all ON public.notif_event_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 5) Templates + version history --------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL REFERENCES public.notif_event_types(code) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  audience text NOT NULL DEFAULT 'customer', -- customer | admin
  language text NOT NULL DEFAULT 'ar',
  subject text,
  body text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  variables_used text[] NOT NULL DEFAULT ARRAY[]::text[],
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_code, channel, audience, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_templates TO authenticated;
GRANT ALL ON public.notif_templates TO service_role;
ALTER TABLE public.notif_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_templates_admin_all ON public.notif_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.notif_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.notif_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  subject text,
  body text NOT NULL,
  variables_used text[] NOT NULL DEFAULT ARRAY[]::text[],
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_template_versions_template_idx ON public.notif_template_versions(template_id, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_template_versions TO authenticated;
GRANT ALL ON public.notif_template_versions TO service_role;
ALTER TABLE public.notif_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_template_versions_admin_all ON public.notif_template_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 6) Outbound queue ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  audience text NOT NULL DEFAULT 'customer',
  channel text NOT NULL DEFAULT 'whatsapp',
  provider_id uuid REFERENCES public.notif_providers(id) ON DELETE SET NULL,
  recipient_phone text,
  recipient_email text,
  recipient_user_id uuid,
  language text NOT NULL DEFAULT 'ar',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_body text,
  status text NOT NULL DEFAULT 'pending', -- pending|processing|sent|failed|retrying|cancelled
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  dedupe_key text,
  related_entity text,
  related_entity_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS notif_queue_status_sched_idx ON public.notif_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS notif_queue_dedupe_idx ON public.notif_queue(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notif_queue_entity_idx ON public.notif_queue(related_entity, related_entity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_queue TO authenticated;
GRANT ALL ON public.notif_queue TO service_role;
ALTER TABLE public.notif_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_queue_admin_all ON public.notif_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 7) Delivery logs (every attempt) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.notif_queue(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.notif_providers(id) ON DELETE SET NULL,
  event_code text,
  audience text,
  channel text,
  recipient_phone text,
  status text NOT NULL, -- sent | failed
  http_status integer,
  duration_ms integer,
  request_snapshot jsonb,
  response_snapshot jsonb,
  error_message text,
  attempt integer NOT NULL DEFAULT 1,
  ip_address text,
  triggered_by uuid,
  triggered_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_delivery_logs_created_idx ON public.notif_delivery_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS notif_delivery_logs_event_idx ON public.notif_delivery_logs(event_code, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_delivery_logs TO authenticated;
GRANT ALL ON public.notif_delivery_logs TO service_role;
ALTER TABLE public.notif_delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_delivery_logs_admin_all ON public.notif_delivery_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 8) Daily analytics rollup -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  event_code text NOT NULL,
  provider_id uuid REFERENCES public.notif_providers(id) ON DELETE SET NULL,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  avg_duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day, event_code, provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_analytics_daily TO authenticated;
GRANT ALL ON public.notif_analytics_daily TO service_role;
ALTER TABLE public.notif_analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_analytics_daily_admin_all ON public.notif_analytics_daily FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 9) Admin recipients (phone numbers that receive admin events) -------------
CREATE TABLE IF NOT EXISTS public.notif_admin_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  phone text NOT NULL,
  email text,
  events text[] NOT NULL DEFAULT ARRAY[]::text[], -- empty = all admin events
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_admin_recipients TO authenticated;
GRANT ALL ON public.notif_admin_recipients TO service_role;
ALTER TABLE public.notif_admin_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_admin_recipients_admin_all ON public.notif_admin_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 10) Broadcast jobs --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notif_broadcast_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_body text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft|scheduled|running|completed|cancelled|failed
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_broadcast_jobs TO authenticated;
GRANT ALL ON public.notif_broadcast_jobs TO service_role;
ALTER TABLE public.notif_broadcast_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_broadcast_jobs_admin_all ON public.notif_broadcast_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 11) Shared updated_at trigger ---------------------------------------------
CREATE OR REPLACE FUNCTION public.notif_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'notif_providers','notif_provider_credentials','notif_provider_health',
    'notif_event_types','notif_templates','notif_queue',
    'notif_analytics_daily','notif_admin_recipients','notif_broadcast_jobs'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_touch ON public.%1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.notif_touch_updated_at();', t);
  END LOOP;
END $$;

-- 12) Seed built-in providers ----------------------------------------------
INSERT INTO public.notif_providers (code, name, channel, is_enabled, is_default, priority, capabilities, config_schema, notes)
VALUES
  ('wasender','WasenderAPI','whatsapp', false, true, 10,
   '{"send_text":true,"send_media":true,"webhooks":true,"session":true}'::jsonb,
   '{"fields":["api_url","api_key","session_name","webhook_secret","timeout_ms","retry_attempts","retry_delay_ms","ssl_verify"]}'::jsonb,
   'Primary WhatsApp provider'),
  ('meta_cloud','Meta WhatsApp Cloud API','whatsapp', false, false, 20,
   '{"send_text":true,"send_media":true,"webhooks":true,"templates":true}'::jsonb,
   '{"fields":["api_url","api_key","phone_number_id","webhook_secret","timeout_ms","retry_attempts","retry_delay_ms"]}'::jsonb,
   'Official Meta provider'),
  ('twilio','Twilio WhatsApp','whatsapp', false, false, 30,
   '{"send_text":true,"send_media":true,"webhooks":true}'::jsonb,
   '{"fields":["api_url","api_key","instance_id","phone_number_id","timeout_ms","retry_attempts","retry_delay_ms"]}'::jsonb,
   'Twilio-backed provider'),
  ('custom','Custom Provider','whatsapp', false, false, 90,
   '{"send_text":true}'::jsonb,
   '{"fields":["api_url","api_key","webhook_secret","timeout_ms","retry_attempts","retry_delay_ms","ssl_verify","extra"]}'::jsonb,
   'User-defined HTTP provider')
ON CONFLICT (code) DO NOTHING;

-- 13) Seed event types ------------------------------------------------------
INSERT INTO public.notif_event_types (code, name_ar, name_en, audience, category, supported_variables) VALUES
  ('order.created','تم إنشاء الطلب','Order Created','both','orders', ARRAY['customer_name','order_number','order_total','payment_method','currency','store_name']),
  ('order.paid','تم دفع الطلب','Order Paid','both','orders', ARRAY['customer_name','order_number','order_total','payment_method']),
  ('order.confirmed','تم تأكيد الطلب','Order Confirmed','customer','orders', ARRAY['customer_name','order_number']),
  ('order.processing','قيد التجهيز','Order Processing','customer','orders', ARRAY['customer_name','order_number']),
  ('order.ready','جاهز للشحن','Order Ready','customer','orders', ARRAY['customer_name','order_number']),
  ('order.shipped','تم الشحن','Order Shipped','customer','orders', ARRAY['customer_name','order_number','tracking_number','tracking_url','estimated_delivery']),
  ('order.delivered','تم التسليم','Order Delivered','customer','orders', ARRAY['customer_name','order_number']),
  ('order.cancelled','تم إلغاء الطلب','Order Cancelled','both','orders', ARRAY['customer_name','order_number']),
  ('order.refunded','تم استرداد المبلغ','Order Refunded','both','orders', ARRAY['customer_name','order_number','order_total']),
  ('payment.failed','فشل الدفع','Payment Failed','both','payments', ARRAY['customer_name','order_number','payment_method']),
  ('cart.abandoned','سلة متروكة','Abandoned Cart','customer','marketing', ARRAY['customer_name','store_url']),
  ('account.created','تم إنشاء الحساب','Account Created','customer','account', ARRAY['customer_name','store_name']),
  ('account.password_reset','إعادة تعيين كلمة المرور','Password Reset','customer','account', ARRAY['customer_name']),
  ('account.otp','رمز التحقق','OTP Verification','customer','account', ARRAY['otp_code']),
  ('account.email_changed','تم تغيير البريد','Email Changed','customer','account', ARRAY['customer_name']),
  ('account.phone_changed','تم تغيير الجوال','Phone Changed','customer','account', ARRAY['customer_name']),
  ('inventory.low_stock','مخزون منخفض','Low Stock','admin','inventory', ARRAY['product_name','stock']),
  ('inventory.out_of_stock','نفاد المخزون','Out Of Stock','admin','inventory', ARRAY['product_name']),
  ('admin.login','تسجيل دخول مسؤول','Admin Login','admin','security', ARRAY['admin_email','ip']),
  ('admin.alert','تنبيه إداري','Admin Alert','admin','security', ARRAY['message']),
  ('broadcast.manual','رسالة جماعية','Manual Broadcast','customer','marketing', ARRAY['message']),
  ('custom.event','حدث مخصص','Custom Event','both','custom', ARRAY[]::text[])
ON CONFLICT (code) DO NOTHING;

-- 14) Seed default AR templates for customer order.created & admin order.created
INSERT INTO public.notif_templates (event_code, channel, audience, language, body, is_default, is_enabled, variables_used)
VALUES
  ('order.created','whatsapp','customer','ar',
E'السلام عليكم {{customer_name}}\n\nتم استلام طلبكم بنجاح.\n\nرقم الطلب:\n{{order_number}}\n\nإجمالي الطلب:\n{{order_total}} {{currency}}\n\nطريقة الدفع:\n{{payment_method}}\n\nسنبدأ بمراجعته وسيتم إشعاركم بكل تحديث.\n\nشكراً لتسوقكم معنا 🌹',
   true, true, ARRAY['customer_name','order_number','order_total','currency','payment_method']),
  ('order.created','whatsapp','admin','ar',
E'طلب جديد.\n\nرقم الطلب:\n{{order_number}}\n\nالعميل:\n{{customer_name}}\n\nرقم الهاتف:\n{{customer_phone}}\n\nالإجمالي:\n{{order_total}} {{currency}}\n\nطريقة الدفع:\n{{payment_method}}\n\nادخل لوحة التحكم لمراجعة الطلب.',
   true, true, ARRAY['order_number','customer_name','customer_phone','order_total','currency','payment_method'])
ON CONFLICT (event_code, channel, audience, language) DO NOTHING;
