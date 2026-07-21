
INSERT INTO public.notif_templates
  (event_code, channel, audience, language, subject, body, is_enabled, is_default)
SELECT
  w.event_code, 'email' AS channel, w.audience, w.language,
  COALESCE(NULLIF(w.subject,''),
    CASE w.language
      WHEN 'ar' THEN
        CASE
          WHEN w.event_code ILIKE '%paid%' THEN 'تأكيد الدفع لطلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE 'admin_%order%' OR w.event_code='admin_new_order' THEN 'طلب جديد #{{order_number}}'
          WHEN w.event_code ILIKE 'order%confirm%' OR w.event_code IN ('order.placed','order_created') THEN 'تم استلام طلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE '%shipped%' THEN 'تم شحن طلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE '%out_for_delivery%' OR w.event_code ILIKE '%delivery%' THEN 'تحديث توصيل طلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE '%delivered%' THEN 'تم توصيل طلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE '%cancel%' THEN 'تم إلغاء طلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE '%refund%' THEN 'تحديث استرداد طلبك رقم #{{order_number}}'
          WHEN w.event_code ILIKE '%return%' THEN 'طلب إرجاع #{{order_number}}'
          WHEN w.event_code ILIKE '%invoice%' THEN 'فاتورتك جاهزة'
          WHEN w.event_code ILIKE '%coupon%' THEN 'كوبون خاص لك'
          WHEN w.event_code ILIKE '%cart%' THEN 'أكمل عملية الشراء'
          WHEN w.event_code ILIKE 'account%' OR w.event_code ILIKE '%otp%' OR w.event_code ILIKE '%verified%' OR w.event_code ILIKE '%password%' THEN 'إشعار حسابك'
          WHEN w.event_code ILIKE '%loyalty%' THEN 'نقاط الولاء'
          WHEN w.event_code ILIKE '%review%' THEN 'شاركنا رأيك'
          WHEN w.event_code ILIKE 'admin_%' OR w.event_code ILIKE 'inventory%' THEN 'تنبيه إداري: ' || replace(w.event_code,'_',' ')
          ELSE 'إشعار من متجرك'
        END
      ELSE
        CASE
          WHEN w.event_code ILIKE '%paid%' THEN 'Payment confirmed for order #{{order_number}}'
          WHEN w.event_code ILIKE 'admin_%order%' OR w.event_code='admin_new_order' THEN 'New order #{{order_number}}'
          WHEN w.event_code ILIKE 'order%confirm%' OR w.event_code IN ('order.placed','order_created') THEN 'Your order #{{order_number}} has been received'
          WHEN w.event_code ILIKE '%shipped%' THEN 'Your order #{{order_number}} has shipped'
          WHEN w.event_code ILIKE '%out_for_delivery%' OR w.event_code ILIKE '%delivery%' THEN 'Delivery update for order #{{order_number}}'
          WHEN w.event_code ILIKE '%delivered%' THEN 'Your order #{{order_number}} has been delivered'
          WHEN w.event_code ILIKE '%cancel%' THEN 'Your order #{{order_number}} was cancelled'
          WHEN w.event_code ILIKE '%refund%' THEN 'Refund update for order #{{order_number}}'
          WHEN w.event_code ILIKE '%return%' THEN 'Return request for order #{{order_number}}'
          WHEN w.event_code ILIKE '%invoice%' THEN 'Your invoice is ready'
          WHEN w.event_code ILIKE '%coupon%' THEN 'A coupon just for you'
          WHEN w.event_code ILIKE '%cart%' THEN 'Complete your purchase'
          WHEN w.event_code ILIKE 'account%' OR w.event_code ILIKE '%otp%' OR w.event_code ILIKE '%verified%' OR w.event_code ILIKE '%password%' THEN 'Account notice'
          WHEN w.event_code ILIKE '%loyalty%' THEN 'Loyalty update'
          WHEN w.event_code ILIKE '%review%' THEN 'We would love your feedback'
          WHEN w.event_code ILIKE 'admin_%' OR w.event_code ILIKE 'inventory%' THEN 'Admin alert: ' || replace(w.event_code,'_',' ')
          ELSE 'Notification from your store'
        END
    END) AS subject,
  w.body, true, false
FROM public.notif_templates w
WHERE w.channel='whatsapp' AND w.is_enabled=true
  AND NOT EXISTS (SELECT 1 FROM public.notif_templates e
                  WHERE e.event_code=w.event_code AND e.audience=w.audience
                    AND e.channel='email' AND e.language=w.language);
