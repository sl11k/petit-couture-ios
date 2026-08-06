-- Ensure welcome events are enabled in notif_event_types just in case
INSERT INTO public.notif_event_types(code, name_ar, name_en, description, audience, category, is_enabled, priority, supported_variables)
VALUES
  ('welcome', 'ترحيب بعميل جديد', 'Welcome new customer', 'رسالة ترحيبية عند التسجيل', 'customer', 'customers', true, 2, ARRAY['customer_name']),
  ('admin_new_customer', 'تنبيه بعميل جديد', 'New customer alert', 'تنبيه للمدير عند تسجيل عميل جديد', 'admin', 'customers', true, 2, ARRAY['customer_name', 'customer_email', 'customer_phone'])
ON CONFLICT (code) DO UPDATE SET is_enabled = true;

-- Insert all missing templates
INSERT INTO public.notif_templates(event_code, channel, audience, language, subject, body, is_enabled, is_default, variables_used)
VALUES
  ('welcome', 'email', 'customer', 'ar', 'مرحباً بك في متجرنا', $$أهلاً بك {{customer_name}} في متجرنا! سعداء جداً بانضمامك لعائلتنا.$$, true, true, ARRAY['customer_name']),
  
  ('welcome', 'whatsapp', 'customer', 'ar', 'مرحباً بك في متجرنا', $$أهلاً بك {{customer_name}} في متجرنا! سعداء جداً بانضمامك لعائلتنا.$$, true, true, ARRAY['customer_name']),

  ('admin_new_customer', 'whatsapp', 'admin', 'ar', 'عميل جديد', $$👤 عميل جديد انضم للمتجر
الاسم: {{customer_name}}
الإيميل: {{customer_email}}
الجوال: {{customer_phone}}$$, true, true, ARRAY['customer_name', 'customer_email', 'customer_phone']),

  ('admin_new_customer', 'email', 'admin', 'ar', 'تسجيل عميل جديد', $$👤 عميل جديد انضم للمتجر
الاسم: {{customer_name}}
الإيميل: {{customer_email}}
الجوال: {{customer_phone}}$$, true, true, ARRAY['customer_name', 'customer_email', 'customer_phone']),

  ('order_shipped', 'email', 'customer', 'ar', 'تم شحن طلبك #{{order_number}}', $$📦 مرحباً {{customer_name}}، طلبك *{{order_number}}* في طريقه إليك!
رقم التتبع: {{tracking_number}}
تتبع شحنتك من هنا: {{tracking_url}}$$, true, true, ARRAY['customer_name','order_number','tracking_number','tracking_url']),

  ('order_delivered', 'email', 'customer', 'ar', 'تم توصيل طلبك #{{order_number}}', $$✅ أهلاً {{customer_name}}، تم تسليم طلبك رقم {{order_number}} بنجاح.
نتمنى أن تنال منتجاتنا إعجابك! يسعدنا تقييمك للطلب.$$, true, true, ARRAY['customer_name','order_number']),

  ('order_cancelled_by_admin', 'email', 'customer', 'ar', 'تم إلغاء طلبك #{{order_number}}', $$⚠️ أهلاً {{customer_name}}، نعتذر منك، لقد تم إلغاء طلبك رقم {{order_number}}.
إذا كان لديك استفسار، يرجى التواصل مع الدعم الفني.$$, true, true, ARRAY['customer_name','order_number']),

  ('cart_abandoned_1h', 'email', 'customer', 'ar', 'سلتك في انتظارك', $$مرحباً! لاحظنا أنك تركت بعض المنتجات الرائعة في سلتك 🛒.
لإكمال طلبك، يسعدنا أن نقدم لك كود خصم خاص: *COMEBACK10* للحصول على خصم 10% على سلتك!
يمكنك إكمال الطلب من هنا: https://petitcouture.com/bag$$, true, true, ARRAY[]::text[])
ON CONFLICT (event_code, channel, audience, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_enabled = true,
  is_default = true,
  updated_at = now();

-- Ensure notification rules are enabled for email as well
UPDATE public.notification_rules
SET channels = (
  CASE 
    WHEN channels @> '["email"]'::jsonb THEN channels
    WHEN channels IS NULL THEN '["email"]'::jsonb
    ELSE channels || '["email"]'::jsonb
  END
),
is_enabled = true,
updated_at = now()
WHERE event_code IN ('welcome', 'admin_new_customer', 'order_shipped', 'order_delivered', 'order_cancelled_by_admin', 'cart_abandoned_1h');

UPDATE public.notification_rules
SET channels = (
  CASE 
    WHEN channels @> '["whatsapp"]'::jsonb THEN channels
    WHEN channels IS NULL THEN '["whatsapp"]'::jsonb
    ELSE channels || '["whatsapp"]'::jsonb
  END
),
is_enabled = true,
updated_at = now()
WHERE event_code IN ('welcome', 'admin_new_customer');
