
-- Templates
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  event_code text NOT NULL,
  audience text NOT NULL DEFAULT 'customer',
  channel text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  is_enabled boolean NOT NULL DEFAULT true,
  subject text,
  body text NOT NULL,
  body_html text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_tpl_event ON public.notification_templates(event_code, channel, language);
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage templates" ON public.notification_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Staff read templates" ON public.notification_templates FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));

-- Rules: when an event fires, which channels to use
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  audience text NOT NULL DEFAULT 'customer',
  channels jsonb NOT NULL DEFAULT '["email"]'::jsonb,
  trigger_mode text NOT NULL DEFAULT 'auto',
  allow_resend boolean NOT NULL DEFAULT true,
  max_retries integer NOT NULL DEFAULT 3,
  delay_minutes integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_rule_event ON public.notification_rules(event_code, audience);
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rules" ON public.notification_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Staff read rules" ON public.notification_rules FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));

-- Notification log
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  template_key text,
  channel text NOT NULL,
  audience text NOT NULL DEFAULT 'customer',
  recipient_user_id uuid,
  recipient_email text,
  recipient_phone text,
  subject text,
  body_preview text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  related_entity text,
  related_entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid,
  triggered_by_email text,
  sent_at timestamp with time zone,
  failed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_nlog_recipient ON public.notification_log(recipient_user_id, created_at DESC);
CREATE INDEX idx_nlog_event ON public.notification_log(event_code, created_at DESC);
CREATE INDEX idx_nlog_status ON public.notification_log(status, created_at DESC);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers see own notifications" ON public.notification_log FOR SELECT TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer')
  );
CREATE POLICY "Authenticated insert log" ON public.notification_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update log" ON public.notification_log FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));

-- Admin in-app notifications (for staff/admin dashboard)
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  related_entity text,
  related_entity_id text,
  link text,
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_admnotif_created ON public.admin_notifications(created_at DESC);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read admin notifications" ON public.admin_notifications FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));
CREATE POLICY "Authenticated insert admin notifications" ON public.admin_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update admin notifications" ON public.admin_notifications FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));

-- Notification preferences (per customer)
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  marketing_email boolean NOT NULL DEFAULT false,
  marketing_sms boolean NOT NULL DEFAULT false,
  marketing_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own prefs" ON public.notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE POLICY "Users upsert own prefs" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Web Push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Triggers
CREATE TRIGGER touch_tpl_upd BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_rules_upd BEFORE UPDATE ON public.notification_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_prefs_upd BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime for admin_notifications + notification_log
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_log;

-- Seed default rules and templates
INSERT INTO public.notification_rules (event_code, audience, channels, trigger_mode, description) VALUES
  ('order_created','customer','["email","whatsapp","in_app"]'::jsonb,'auto','تأكيد إنشاء الطلب'),
  ('payment_succeeded','customer','["email","sms"]'::jsonb,'auto','تأكيد الدفع'),
  ('payment_failed','customer','["email","sms"]'::jsonb,'auto','فشل الدفع'),
  ('order_processing','customer','["whatsapp","in_app"]'::jsonb,'auto','الطلب قيد التجهيز'),
  ('order_shipped','customer','["sms","whatsapp","email"]'::jsonb,'auto','تم الشحن مع رقم التتبع'),
  ('order_out_for_delivery','customer','["sms","whatsapp"]'::jsonb,'auto','خرج للتوصيل'),
  ('order_delivered','customer','["whatsapp","email"]'::jsonb,'auto','تم التسليم'),
  ('review_request','customer','["email","whatsapp"]'::jsonb,'auto','طلب تقييم بعد التسليم'),
  ('cart_abandoned','customer','["email","whatsapp"]'::jsonb,'auto','تذكير سلة متروكة'),
  ('manual_payment_link','customer','["whatsapp","sms"]'::jsonb,'manual','إرسال رابط دفع'),
  ('refund_status','customer','["email","sms"]'::jsonb,'auto','تحديث حالة الاسترجاع'),
  ('back_in_stock','customer','["email","whatsapp"]'::jsonb,'auto','توفر منتج'),
  ('promotion','customer','["email"]'::jsonb,'manual','عروض (يحتاج موافقة)'),
  ('admin_new_order','admin','["in_app","email"]'::jsonb,'auto','طلب جديد'),
  ('admin_payment_received','admin','["in_app"]'::jsonb,'auto','دفع جديد'),
  ('admin_payment_failed','admin','["in_app"]'::jsonb,'auto','فشل دفع'),
  ('admin_pending_review','admin','["in_app","email"]'::jsonb,'auto','طلب يحتاج مراجعة'),
  ('admin_low_stock','admin','["in_app","email"]'::jsonb,'auto','منتج منخفض المخزون'),
  ('admin_out_of_stock','admin','["in_app","email"]'::jsonb,'auto','نفاد منتج'),
  ('admin_shipment_failed','admin','["in_app","email"]'::jsonb,'auto','فشل إنشاء شحنة'),
  ('admin_order_delayed','admin','["in_app"]'::jsonb,'auto','تأخر تجهيز الطلب'),
  ('admin_shipment_delayed','admin','["in_app"]'::jsonb,'auto','تأخر الشحنة'),
  ('admin_return_requested','admin','["in_app","email"]'::jsonb,'auto','طلب استرجاع'),
  ('admin_customer_message','admin','["in_app"]'::jsonb,'auto','رسالة عميل'),
  ('admin_integration_error','admin','["in_app","email"]'::jsonb,'auto','خطأ تكامل');

INSERT INTO public.notification_templates (template_key, event_code, audience, channel, language, subject, body, variables, description) VALUES
  ('order_created.email.ar','order_created','customer','email','ar','تأكيد طلبك {{order_number}}','مرحبًا {{customer_name}}،\nتم استلام طلبك رقم {{order_number}} بقيمة {{total}} ريال.\nسنقوم بإشعارك عند الشحن.\nشكرًا لثقتك.','["customer_name","order_number","total"]'::jsonb,'تأكيد إنشاء الطلب'),
  ('order_created.whatsapp.ar','order_created','customer','whatsapp','ar',NULL,'مرحبًا {{customer_name}} 👋\nتم استلام طلبك *{{order_number}}* بقيمة {{total}} ريال.\nسنبقيك على اطلاع.','["customer_name","order_number","total"]'::jsonb,'واتساب تأكيد طلب'),
  ('payment_succeeded.email.ar','payment_succeeded','customer','email','ar','تم استلام دفعتك','تم تأكيد دفع طلب {{order_number}} بقيمة {{amount}} ريال. شكرًا لك.','["order_number","amount"]'::jsonb,'تأكيد دفع'),
  ('payment_succeeded.sms.ar','payment_succeeded','customer','sms','ar',NULL,'تم تأكيد دفع طلبك {{order_number}} بقيمة {{amount}} ريال.','["order_number","amount"]'::jsonb,'SMS دفع'),
  ('payment_failed.sms.ar','payment_failed','customer','sms','ar',NULL,'فشل دفع طلبك {{order_number}}. يمكنك إعادة المحاولة عبر: {{payment_link}}','["order_number","payment_link"]'::jsonb,'SMS فشل دفع'),
  ('order_shipped.sms.ar','order_shipped','customer','sms','ar',NULL,'تم شحن طلبك {{order_number}}. رقم التتبع: {{tracking_number}}\nتتبع: {{tracking_url}}','["order_number","tracking_number","tracking_url"]'::jsonb,'SMS شحن'),
  ('order_shipped.whatsapp.ar','order_shipped','customer','whatsapp','ar',NULL,'📦 طلبك *{{order_number}}* في طريقه إليك!\nرقم التتبع: {{tracking_number}}\n{{tracking_url}}','["order_number","tracking_number","tracking_url"]'::jsonb,'واتساب شحن'),
  ('order_delivered.whatsapp.ar','order_delivered','customer','whatsapp','ar',NULL,'تم تسليم طلبك {{order_number}} ✅\nنتمنى أن ينال إعجابك. شكرًا لك.','["order_number"]'::jsonb,'واتساب تسليم'),
  ('cart_abandoned.email.ar','cart_abandoned','customer','email','ar','أكمل طلبك في {{site_name}}','مرحبًا{{#customer_name}} {{customer_name}}{{/customer_name}}،\nلاحظنا أنك تركت بعض المنتجات في سلتك بقيمة {{cart_total}} ريال.\nأكمل طلبك من هنا: {{recovery_link}}','["customer_name","cart_total","recovery_link","site_name"]'::jsonb,'سلة متروكة'),
  ('manual_payment_link.whatsapp.ar','manual_payment_link','customer','whatsapp','ar',NULL,'مرحبًا {{customer_name}}،\nرابط دفع طلبك {{order_number}} بقيمة {{amount}} ريال:\n{{payment_link}}','["customer_name","order_number","amount","payment_link"]'::jsonb,'واتساب رابط دفع'),
  ('back_in_stock.email.ar','back_in_stock','customer','email','ar','توفر المنتج {{product_name}}','المنتج {{product_name}} الذي طلبت إشعارًا عنه أصبح متوفرًا الآن.\nاطلبه: {{product_link}}','["product_name","product_link"]'::jsonb,'توفر منتج'),
  ('admin_new_order.in_app.ar','admin_new_order','admin','in_app','ar','طلب جديد','طلب جديد {{order_number}} بقيمة {{total}} ريال من {{customer_name}}','["order_number","total","customer_name"]'::jsonb,'إشعار طلب جديد'),
  ('admin_low_stock.in_app.ar','admin_low_stock','admin','in_app','ar','مخزون منخفض','المنتج {{product_name}} وصل إلى {{stock}} قطعة','["product_name","stock"]'::jsonb,'مخزون منخفض'),
  ('admin_payment_failed.in_app.ar','admin_payment_failed','admin','in_app','ar','فشل دفع','فشل دفع طلب {{order_number}}: {{reason}}','["order_number","reason"]'::jsonb,'فشل دفع');
