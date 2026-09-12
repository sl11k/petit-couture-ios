INSERT INTO public.notif_event_types (code, name_ar, name_en, audience, category)
VALUES ('order_tracking_update','تحديث تتبع الطلب','Order tracking update','customer','shipping')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.notif_templates (event_code, channel, audience, language, subject, body, is_enabled)
VALUES
('shipment_created','whatsapp','customer','ar','تم تجهيز شحنتك','📦 مرحباً {{customer_name}}، تم تجهيز شحنة طلبك *{{order_number}}*.
{{#tracking_number}}رقم التتبع: {{tracking_number}}
{{/tracking_number}}{{#tracking_url}}تتبع شحنتك من هنا: {{tracking_url}}{{/tracking_url}}',true),
('shipment_created','email','customer','ar','تم تجهيز شحنة طلبك #{{order_number}}','مرحباً {{customer_name}}،
تم تجهيز شحنة طلبك {{order_number}}.
{{#tracking_number}}رقم التتبع: {{tracking_number}}
{{/tracking_number}}{{#tracking_url}}رابط التتبع: {{tracking_url}}{{/tracking_url}}',true),
('order_tracking_update','whatsapp','customer','ar','تحديث على طلبك','🔔 مرحباً {{customer_name}}، تم تحديث حالة طلبك *{{order_number}}*.
الحالة: {{status}}
{{#tracking_number}}رقم التتبع: {{tracking_number}}
{{/tracking_number}}{{#tracking_url}}رابط التتبع: {{tracking_url}}{{/tracking_url}}',true),
('order_tracking_update','email','customer','ar','تحديث حالة طلبك #{{order_number}}','مرحباً {{customer_name}}،
تم تحديث حالة طلبك {{order_number}} إلى: {{status}}.
{{#tracking_number}}رقم التتبع: {{tracking_number}}
{{/tracking_number}}{{#tracking_url}}رابط التتبع: {{tracking_url}}{{/tracking_url}}',true),
('admin_abandoned_cart_high_value','whatsapp','admin','ar','سلة متروكة بقيمة عالية','🛒 سلة متروكة بقيمة عالية
العميل: {{customer_name}}
الجوال: {{customer_phone}}
القيمة: {{total}} {{currency}}',true),
('admin_abandoned_cart_high_value','email','admin','ar','سلة متروكة بقيمة عالية','سلة متروكة بقيمة عالية
العميل: {{customer_name}}
الجوال: {{customer_phone}}
القيمة: {{total}} {{currency}}
راجعها من لوحة التحكم.',true)
ON CONFLICT DO NOTHING;