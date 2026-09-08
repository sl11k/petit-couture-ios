
INSERT INTO public.notif_event_types (code, name_ar, name_en, category, audience, is_enabled, supported_variables)
VALUES ('order.abandoned_recovery', 'لم تُكمل طلبك', 'Order not completed', 'marketing', 'customer', true,
        ARRAY['customer_name','order_number','coupon_code','discount','recovery_url','cart_total','currency'])
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.notif_templates (event_code, channel, audience, language, subject, body)
VALUES
('order.abandoned_recovery','whatsapp','customer','ar', NULL,
'مرحباً {{customer_name}} 👋
لاحظنا أنك ما أكملت طلبك رقم {{order_number}} 🌿

منتجاتك ما زالت محجوزة لك، وحبينا نسهّل عليك القرار:
🎁 خصم {{discount}} خاص لك بكود: *{{coupon_code}}*
⏰ صالح لمدة 48 ساعة فقط

أكمل طلبك من هنا:
{{recovery_url}}

وإذا واجهتك أي مشكلة في الدفع أو عندك أي استفسار، ردّ علينا هنا وبنساعدك فورًا 💚

متجر le petit paradise'),
('order.abandoned_recovery','whatsapp','customer','en', NULL,
'Hi {{customer_name}} 👋
We noticed you didn''t complete order {{order_number}} 🌿

Your items are still waiting for you:
🎁 A special {{discount}} discount just for you: *{{coupon_code}}*
⏰ Valid for 48 hours only

Complete your order here:
{{recovery_url}}

If you had any issue with payment or have a question, just reply here and we''ll help right away 💚

le petit paradise'),
('order.abandoned_recovery','email','customer','ar','سلتك بانتظارك 🌿 خصم {{discount}} خاص لك',
'مرحباً {{customer_name}}،

لاحظنا أنك ما أكملت طلبك رقم {{order_number}}. منتجاتك ما زالت بانتظارك.

خصصنا لك خصم {{discount}} بكود {{coupon_code}} صالح لمدة 48 ساعة.

أكمل طلبك من هنا: {{recovery_url}}

وإذا واجهتك أي مشكلة في الدفع، ردّ على هذا الإيميل وبنساعدك فورًا.

فريق le petit paradise'),
('order.abandoned_recovery','email','customer','en','Your cart is waiting 🌿 {{discount}} off just for you',
'Hi {{customer_name}},

We noticed you didn''t complete order {{order_number}}. Your items are still waiting for you.

Here is a {{discount}} discount with code {{coupon_code}}, valid for 48 hours.

Complete your order here: {{recovery_url}}

If you had any trouble with payment, just reply to this email and we''ll help right away.

le petit paradise team')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count integer := 0;
  o RECORD;
  v_token text;
  v_code text;
  v_link text;
  v_items jsonb;
  v_cart_id uuid;
  v_name text;
BEGIN
  FOR o IN
    SELECT id, order_number, customer_name, customer_email, customer_phone, user_id,
           total, currency, language
      FROM public.orders
     WHERE status = 'pending'
       AND payment_status IN ('unpaid','failed','pending_review')
       AND expires_at IS NOT NULL AND expires_at < now()
  LOOP
    IF EXISTS (SELECT 1 FROM public.orders WHERE id = o.id AND stock_reserved = true) THEN
      PERFORM public.release_expired_order_stock(o.id);
    END IF;
    PERFORM public.release_order_inventory(o.id);

    UPDATE public.orders
    SET status = 'cancelled',
        payment_status = 'expired',
        updated_at = now(),
        internal_notes = COALESCE(internal_notes,'[]'::jsonb) ||
          jsonb_build_array(jsonb_build_object('text','إلغاء تلقائي بعد انتهاء المهلة','at',now(),'system',true))
    WHERE id = o.id;
    cancelled_count := cancelled_count + 1;

    -- Friendly win-back instead of a cancellation message
    BEGIN
      IF (o.customer_phone IS NOT NULL OR o.customer_email IS NOT NULL) THEN
        SELECT jsonb_agg(jsonb_build_object(
                 'slug', oi.product_slug,
                 'name', oi.product_name,
                 'brand', oi.brand,
                 'image', oi.image_url,
                 'price', oi.unit_price,
                 'qty', oi.qty,
                 'size', oi.size,
                 'color', oi.color,
                 'sku', oi.sku,
                 'variant_id', oi.variant_id,
                 'currency', COALESCE(o.currency,'SAR')))
          INTO v_items
          FROM public.order_items oi
         WHERE oi.order_id = o.id;

        IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
          v_token := encode(gen_random_bytes(16),'hex');
          v_code  := 'BACK10' || upper(substr(md5(random()::text || o.id::text),1,6));

          IF NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = v_code) THEN
            INSERT INTO public.coupons(code, name, description, discount_type, discount_value,
                                       max_uses, per_customer_limit, expires_at, is_active)
            VALUES (v_code, 'خصم استعادة طلب', 'خصم خاص لاستكمال الطلب', 'percent', 10, 1, 1,
                    now() + interval '48 hours', true);
          END IF;

          INSERT INTO public.abandoned_carts(user_id, email, phone, items, subtotal, currency,
                                             reached_checkout, converted, stage, source,
                                             recovery_token, recovery_coupon_code,
                                             contact_attempts, last_contacted_at, contact_status)
          VALUES (o.user_id, o.customer_email, o.customer_phone, v_items, COALESCE(o.total,0),
                  COALESCE(o.currency,'SAR'), true, false, 'checkout', 'expired_order',
                  v_token, v_code, 1, now(), 'sent')
          RETURNING id INTO v_cart_id;

          v_link := 'https://lppme.com/recover/' || v_token;
          v_name := COALESCE(NULLIF(o.customer_name,''), 'عميلنا العزيز');

          PERFORM public.enqueue_notification(
            _event_code => 'order.abandoned_recovery',
            _audience   => 'customer',
            _payload    => jsonb_build_object(
                              'customer_name', v_name,
                              'order_number', o.order_number,
                              'coupon_code', v_code,
                              'discount', '10%',
                              'recovery_url', v_link,
                              'store_url', v_link,
                              'cart_total', COALESCE(o.total,0),
                              'currency', COALESCE(o.currency,'SAR')),
            _related_entity    => 'abandoned_cart',
            _related_entity_id => v_cart_id::text,
            _user_id  => o.user_id,
            _phone    => o.customer_phone,
            _email    => o.customer_email,
            _language => COALESCE(o.language,'ar'));

          INSERT INTO public.cart_recovery_attempts(cart_id, channel, status, coupon_code, message, metadata)
          VALUES (v_cart_id,
                  CASE WHEN o.customer_phone IS NOT NULL THEN 'whatsapp' ELSE 'email' END,
                  'queued', v_code, v_link,
                  jsonb_build_object('auto', true, 'order_id', o.id));
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
  RETURN cancelled_count;
END;
$$;
