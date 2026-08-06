-- Enable cart_abandoned_1h in notif_event_types
INSERT INTO public.notif_event_types(code, name_ar, name_en, description, audience, category, is_enabled, priority, supported_variables)
VALUES
  ('cart_abandoned_1h', 'سلة متروكة (ساعة واحدة)', 'Abandoned Cart (1h)', 'إشعار للعميل عند ترك السلة لمدة ساعة دون إكمال الدفع', 'customer', 'carts', true, 3, ARRAY['cart_id', 'subtotal'])
ON CONFLICT (code) DO UPDATE SET
  is_enabled = true,
  updated_at = now();

-- Ensure templates for WhatsApp exist for these events
INSERT INTO public.notif_templates(event_code, channel, audience, language, subject, body, is_enabled, is_default, variables_used)
VALUES
  ('order_shipped', 'whatsapp', 'customer', 'ar', 'تم شحن طلبك', $$📦 مرحباً {{customer_name}}، طلبك *{{order_number}}* في طريقه إليك!
رقم التتبع: {{tracking_number}}
تتبع شحنتك من هنا: {{tracking_url}}$$, true, true, ARRAY['customer_name','order_number','tracking_number','tracking_url']),
  
  ('order_delivered', 'whatsapp', 'customer', 'ar', 'تم تسليم طلبك', $$✅ أهلاً {{customer_name}}، تم تسليم طلبك رقم {{order_number}} بنجاح.
نتمنى أن تنال منتجاتنا إعجابك! يسعدنا تقييمك للطلب.$$, true, true, ARRAY['customer_name','order_number']),

  ('order_cancelled_by_admin', 'whatsapp', 'customer', 'ar', 'تم إلغاء طلبك', $$⚠️ أهلاً {{customer_name}}، نعتذر منك، لقد تم إلغاء طلبك رقم {{order_number}}.
إذا كان لديك استفسار، يرجى التواصل مع الدعم الفني.$$, true, true, ARRAY['customer_name','order_number']),

  ('cart_abandoned_1h', 'whatsapp', 'customer', 'ar', 'سلتك في انتظارك', $$مرحباً! لاحظنا أنك تركت بعض المنتجات الرائعة في سلتك 🛒.
لإكمال طلبك، يسعدنا أن نقدم لك كود خصم خاص: *COMEBACK10* للحصول على خصم 10% على سلتك!
يمكنك إكمال الطلب من هنا: https://petitcouture.com/bag$$, true, true, ARRAY[]::text[])
ON CONFLICT (event_code, channel, audience, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_enabled = true,
  is_default = true,
  updated_at = now();

-- Ensure rules have WhatsApp enabled
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
WHERE event_code IN ('order_shipped', 'order_delivered', 'order_cancelled_by_admin', 'cart_abandoned_1h');

-- Ensure cart_abandoned_1h rule exists
INSERT INTO public.notification_rules (event_code, audience, channels, trigger_mode, description)
SELECT 'cart_abandoned_1h', 'customer', '["whatsapp", "email"]'::jsonb, 'auto', 'تذكير بالسلة المتروكة'
WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_rules WHERE event_code = 'cart_abandoned_1h' AND audience = 'customer'
);

-- Insert the COMEBACK10 discount coupon
INSERT INTO public.coupons (
  id, code, type, value, is_active, max_uses, usage_count,
  min_order_amount, applies_to, product_ids, category_ids
)
SELECT 
  gen_random_uuid(), 'COMEBACK10', 'percentage', 10, true, null, 0,
  0, 'all', null, null
WHERE NOT EXISTS (
  SELECT 1 FROM public.coupons WHERE code = 'COMEBACK10'
);
