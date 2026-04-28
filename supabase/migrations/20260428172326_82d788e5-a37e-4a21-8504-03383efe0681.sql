
-- Messaging providers
CREATE TABLE public.messaging_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms')),
  provider_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_per_message numeric(10,4) DEFAULT 0,
  monthly_budget numeric(10,2),
  monthly_spend numeric(10,2) NOT NULL DEFAULT 0,
  spend_reset_at timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Conversations (per customer per channel)
CREATE TABLE public.messaging_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id uuid,
  customer_phone text NOT NULL,
  customer_name text,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms')),
  related_order_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','archived')),
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_conv_phone_channel ON public.messaging_conversations(customer_phone, channel);
CREATE INDEX idx_msg_conv_user ON public.messaging_conversations(customer_user_id);
CREATE INDEX idx_msg_conv_status ON public.messaging_conversations(status);

-- Messages
CREATE TABLE public.messaging_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.messaging_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  channel text NOT NULL,
  provider_id uuid REFERENCES public.messaging_providers(id) ON DELETE SET NULL,
  provider_message_id text,
  template_key text,
  body text NOT NULL,
  media_url text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed','received')),
  cost numeric(10,4) DEFAULT 0,
  error_message text,
  related_order_id uuid,
  related_entity text,
  related_entity_id uuid,
  sent_by uuid,
  sent_by_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz
);
CREATE INDEX idx_msg_messages_conv ON public.messaging_messages(conversation_id, created_at DESC);
CREATE INDEX idx_msg_messages_order ON public.messaging_messages(related_order_id);

-- Quick replies
CREATE TABLE public.messaging_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  channel text CHECK (channel IN ('whatsapp','sms','any')) DEFAULT 'any',
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- OTP codes (for SMS verification)
CREATE TABLE public.sms_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'verification',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_otp_phone ON public.sms_otp_codes(phone, created_at DESC);

-- Monthly cost log (per provider per day)
CREATE TABLE public.messaging_costs_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.messaging_providers(id) ON DELETE CASCADE,
  channel text NOT NULL,
  day date NOT NULL DEFAULT CURRENT_DATE,
  message_count int NOT NULL DEFAULT 0,
  total_cost numeric(10,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, day)
);

-- Triggers
CREATE TRIGGER trg_msg_providers_updated BEFORE UPDATE ON public.messaging_providers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_msg_conv_updated BEFORE UPDATE ON public.messaging_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_costs_log ENABLE ROW LEVEL SECURITY;

-- Admin/Manager/Staff policies
CREATE POLICY "staff_all_providers" ON public.messaging_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "staff_all_conv" ON public.messaging_conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY "staff_all_msgs" ON public.messaging_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY "staff_all_qr" ON public.messaging_quick_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "admin_otp" ON public.sms_otp_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "staff_costs" ON public.messaging_costs_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Seed default providers
INSERT INTO public.messaging_providers (name, channel, provider_type, priority, is_enabled, cost_per_message, config) VALUES
  ('Twilio WhatsApp', 'whatsapp', 'twilio', 10, false, 0.05, '{"from":"whatsapp:+14155238886"}'::jsonb),
  ('WhatsApp Web (Manual)', 'whatsapp', 'wa_link', 90, true, 0, '{}'::jsonb),
  ('Twilio SMS', 'sms', 'twilio', 10, false, 0.03, '{"from":"+15017122661"}'::jsonb),
  ('Unifonic SMS', 'sms', 'unifonic', 20, false, 0.02, '{"sender":"Maisonnet"}'::jsonb);

-- Seed quick replies
INSERT INTO public.messaging_quick_replies (title, body, channel, sort_order) VALUES
  ('ترحيب', 'مرحبًا بك في Maisonnet 👋 كيف يمكننا مساعدتك؟', 'any', 1),
  ('تأكيد الطلب', 'تم استلام طلبك بنجاح، سنبدأ بتجهيزه قريبًا.', 'any', 2),
  ('رابط دفع', 'يمكنك إكمال الدفع عبر الرابط التالي: {{payment_link}}', 'any', 3),
  ('رقم التتبع', 'تم شحن طلبك. رقم التتبع: {{tracking_number}}', 'any', 4),
  ('شكر', 'شكرًا لتسوقك معنا! نسعد بخدمتك دائمًا.', 'any', 5);
