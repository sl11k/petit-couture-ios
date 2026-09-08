CREATE OR REPLACE FUNCTION public.notif_template_render(_body text, _payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := COALESCE(_body, '');
  kv record;
BEGIN
  FOR kv IN SELECT key, value FROM jsonb_each_text(COALESCE(_payload, '{}'::jsonb)) LOOP
    result := replace(result, '{{' || kv.key || '}}', COALESCE(kv.value, ''));
    result := replace(result, '{{ ' || kv.key || ' }}', COALESCE(kv.value, ''));
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _event_code text,
  _audience text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _related_entity text DEFAULT NULL::text,
  _related_entity_id text DEFAULT NULL::text,
  _user_id uuid DEFAULT NULL::uuid,
  _phone text DEFAULT NULL::text,
  _email text DEFAULT NULL::text,
  _language text DEFAULT 'ar'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  ch text;
  tpl_subject text;
  tpl_body text;
  body_rendered text;
  subj_rendered text;
  dedupe text;
  p_phone text := NULLIF(_phone, '');
  p_email text := NULLIF(_email, '');
  p_name text := NULL;
  admin_rec record;
  admin_idx integer := 0;
  base_scheduled timestamptz;
BEGIN
  IF _event_code IS NULL OR _audience IS NULL THEN
    RETURN;
  END IF;

  IF _user_id IS NOT NULL AND (p_phone IS NULL OR p_email IS NULL) THEN
    SELECT COALESCE(p_phone, phone), COALESCE(p_email, email), full_name
      INTO p_phone, p_email, p_name
      FROM public.profiles
      WHERE user_id = _user_id;
  END IF;

  SELECT * INTO r
  FROM public.notification_rules
  WHERE event_code = _event_code
    AND audience = _audience
    AND is_enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF COALESCE(r.trigger_mode, 'auto') <> 'auto' THEN
    RETURN;
  END IF;

  base_scheduled := now() + make_interval(mins => COALESCE(r.delay_minutes, 0));

  FOR ch IN SELECT jsonb_array_elements_text(COALESCE(r.channels, '[]'::jsonb)) LOOP
    tpl_subject := NULL;
    tpl_body := NULL;
    body_rendered := NULL;
    subj_rendered := NULL;

    SELECT nt.subject, nt.body
      INTO tpl_subject, tpl_body
      FROM public.notification_templates nt
      WHERE nt.event_code = _event_code
        AND nt.audience = _audience
        AND nt.channel = ch
        AND nt.language = _language
        AND nt.is_enabled = true
      LIMIT 1;

    IF tpl_body IS NULL THEN
      SELECT nt.subject, nt.body
        INTO tpl_subject, tpl_body
        FROM public.notification_templates nt
        WHERE nt.event_code = _event_code
          AND nt.audience = _audience
          AND nt.channel = ch
          AND nt.is_enabled = true
        ORDER BY CASE WHEN nt.language = 'ar' THEN 0 ELSE 1 END, nt.language
        LIMIT 1;
    END IF;

    IF tpl_body IS NOT NULL THEN
      body_rendered := public.notif_template_render(tpl_body, _payload);
      subj_rendered := public.notif_template_render(tpl_subject, _payload);
    END IF;

    IF ch = 'in_app' THEN
      IF _audience = 'admin' THEN
        INSERT INTO public.admin_notifications(
          event_code, severity, title, body, related_entity, related_entity_id, link, metadata
        ) VALUES (
          _event_code,
          CASE WHEN _event_code ILIKE '%fail%' OR _event_code ILIKE '%error%' OR _event_code ILIKE '%out_of_stock%' THEN 'warning'
               WHEN _event_code ILIKE 'admin_new%' OR _event_code ILIKE '%paid%' OR _event_code ILIKE '%delivered%' THEN 'success'
               ELSE 'info' END,
          COALESCE(NULLIF(subj_rendered, ''), _event_code),
          COALESCE(NULLIF(body_rendered, ''), _event_code),
          _related_entity,
          _related_entity_id,
          CASE _related_entity
            WHEN 'order' THEN '/admin/orders/' || _related_entity_id
            WHEN 'return' THEN '/admin/returns'
            WHEN 'ticket' THEN '/admin/support/' || _related_entity_id
            WHEN 'review' THEN '/admin/reviews'
            WHEN 'customer' THEN '/admin/customers/' || _related_entity_id
            WHEN 'product' THEN '/admin/products/' || _related_entity_id
            WHEN 'shipment' THEN '/admin/shipping?id=' || _related_entity_id
            WHEN 'refund' THEN '/admin/payments?id=' || _related_entity_id
            ELSE NULL END,
          _payload
        );
      END IF;
      CONTINUE;
    END IF;

    IF _audience = 'admin' THEN
      admin_idx := 0;
      FOR admin_rec IN
        SELECT id, phone, email
        FROM public.notif_admin_recipients
        WHERE is_enabled = true
          AND phone IS NOT NULL
          AND phone <> ''
          AND (events IS NULL OR cardinality(events) = 0 OR _event_code = ANY(events))
        ORDER BY created_at, id
      LOOP
        dedupe := _event_code || ':' || _audience || ':' || ch || ':' ||
                  COALESCE(_related_entity_id, gen_random_uuid()::text) || ':' || admin_rec.id::text;

        INSERT INTO public.notif_queue(
          event_code, audience, channel, recipient_phone, recipient_email,
          recipient_user_id, language, payload, rendered_body,
          scheduled_at, dedupe_key, related_entity, related_entity_id, max_attempts
        ) VALUES (
          _event_code, _audience, ch, admin_rec.phone, admin_rec.email,
          NULL, _language, _payload, body_rendered,
          base_scheduled + make_interval(secs => admin_idx * 10),
          dedupe, _related_entity, _related_entity_id, COALESCE(r.max_retries, 3)
        ) ON CONFLICT (dedupe_key) DO NOTHING;

        admin_idx := admin_idx + 1;
      END LOOP;
    ELSE
      IF ch IN ('whatsapp','sms') AND (p_phone IS NULL OR length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 9) THEN
        CONTINUE;
      END IF;
      IF ch = 'email' AND (p_email IS NULL OR p_email = '') THEN
        CONTINUE;
      END IF;

      dedupe := _event_code || ':' || _audience || ':' || ch || ':' ||
                COALESCE(_related_entity_id, gen_random_uuid()::text);

      INSERT INTO public.notif_queue(
        event_code, audience, channel, recipient_phone, recipient_email,
        recipient_user_id, language, payload, rendered_body,
        scheduled_at, dedupe_key, related_entity, related_entity_id, max_attempts
      ) VALUES (
        _event_code, _audience, ch, p_phone, p_email,
        _user_id, _language, _payload, body_rendered,
        base_scheduled, dedupe, _related_entity, _related_entity_id, COALESCE(r.max_retries, 3)
      ) ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_notification failed for %/%: %', _event_code, _audience, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_emit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payload jsonb;
  _total text;
BEGIN
  _total := COALESCE(NEW.total::text, '0');
  _payload := jsonb_build_object(
    'order_id', NEW.id,
    'order_number', NEW.order_number,
    'status', NEW.status,
    'payment_status', NEW.payment_status,
    'payment_method', NEW.payment_method,
    'total', _total,
    'amount', _total,
    'order_total', _total,
    'currency', NEW.currency,
    'customer_id', NEW.user_id,
    'customer_name', NEW.customer_name,
    'customer_phone', NEW.customer_phone,
    'customer_email', NEW.customer_email,
    'created_at', NEW.created_at
  );

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.payment_status, '') IN ('paid', 'captured') THEN
      PERFORM public.emit_webhook_event('order.created', _payload);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status
       AND COALESCE(NEW.payment_status, '') IN ('paid', 'captured') THEN
      PERFORM public.emit_webhook_event('order.paid', _payload);
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'cancelled' AND COALESCE(NEW.payment_status, '') <> 'unpaid' THEN
        PERFORM public.emit_webhook_event('order.cancelled', _payload);
      ELSIF NEW.status = 'shipped' THEN
        PERFORM public.emit_webhook_event('order.shipped', _payload);
      ELSIF NEW.status = 'delivered' THEN
        PERFORM public.emit_webhook_event('order.delivered', _payload);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.webhook_events_to_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p jsonb := NEW.payload;
  et text := NEW.event_type;
  cust_id uuid := NULLIF(p->>'customer_id','')::uuid;
  order_id text := p->>'order_id';
  cust_email text := COALESCE(p->>'customer_email', p->>'email');
  cust_phone text := p->>'customer_phone';
BEGIN
  IF et = 'order.created' THEN
    PERFORM public.enqueue_notification('order_created', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('admin_new_order', 'admin', p, 'order', order_id);
  ELSIF et = 'order.paid' THEN
    PERFORM public.enqueue_notification('order_paid', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('admin_new_order', 'admin', p, 'order', order_id);
  ELSIF et = 'order.shipped' THEN
    PERFORM public.enqueue_notification('order_shipped', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
  ELSIF et = 'order.delivered' THEN
    PERFORM public.enqueue_notification('order_delivered', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    PERFORM public.enqueue_notification('order_completed', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
  ELSIF et = 'order.cancelled' THEN
    IF COALESCE(p->>'payment_status', '') <> 'unpaid' THEN
      PERFORM public.enqueue_notification('order_cancelled_by_admin', 'customer', p, 'order', order_id, cust_id, cust_phone, cust_email);
    END IF;
  ELSIF et = 'customer.created' THEN
    PERFORM public.enqueue_notification('welcome', 'customer', p, 'customer', cust_id::text, cust_id, NULL, cust_email);
    PERFORM public.enqueue_notification('admin_new_customer', 'admin', p, 'customer', cust_id::text);
  ELSIF et = 'inventory.low' THEN
    PERFORM public.enqueue_notification('admin_low_stock', 'admin', p, 'product', p->>'product_id');
    IF COALESCE((p->>'stock')::int, 0) = 0 THEN
      PERFORM public.enqueue_notification('admin_out_of_stock', 'admin', p, 'product', p->>'product_id');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.notif_event_types(code, name_ar, name_en, description, audience, category, is_enabled, priority, supported_variables)
VALUES
  ('order_paid', 'تأكيد دفع الطلب', 'Order payment confirmed', 'رسالة واتساب للعميل بعد تأكيد الدفع', 'customer', 'orders', true, 1, ARRAY['order_number','customer_name','total','amount','order_total','currency','payment_method']),
  ('admin_new_order', 'طلب مدفوع جديد', 'New paid order', 'رسالة واتساب للأدمن بعد تأكيد دفع الطلب', 'admin', 'orders', true, 1, ARRAY['order_number','customer_name','customer_phone','total','order_total','currency','payment_method'])
ON CONFLICT (code) DO UPDATE SET
  is_enabled = true,
  priority = EXCLUDED.priority,
  supported_variables = EXCLUDED.supported_variables,
  updated_at = now();

INSERT INTO public.notif_templates(event_code, channel, audience, language, subject, body, is_enabled, is_default, variables_used)
VALUES
  ('order_paid', 'whatsapp', 'customer', 'ar', 'تم تأكيد الدفع', 'شكراً {{customer_name}} 💚
تم تأكيد الدفع لطلبكم رقم {{order_number}}.
المبلغ: {{total}} {{currency}}
سنبدأ بتجهيز طلبكم فوراً ونبلغكم عند الشحن.', true, true, ARRAY['customer_name','order_number','total','currency']),
  ('admin_new_order', 'whatsapp', 'admin', 'ar', 'طلب مدفوع جديد', 'طلب مدفوع جديد ✅
رقم الطلب: {{order_number}}
العميل: {{customer_name}}
الجوال: {{customer_phone}}
المبلغ: {{total}} {{currency}}
طريقة الدفع: {{payment_method}}
راجع الطلب من لوحة التحكم.', true, true, ARRAY['order_number','customer_name','customer_phone','total','currency','payment_method'])
ON CONFLICT (event_code, channel, audience, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_enabled = true,
  is_default = true,
  variables_used = EXCLUDED.variables_used,
  updated_at = now();

UPDATE public.notification_rules
SET channels = '["whatsapp", "in_app"]'::jsonb,
    trigger_mode = 'auto',
    is_enabled = true,
    updated_at = now()
WHERE event_code IN ('order_paid', 'admin_new_order')
  AND audience IN ('customer', 'admin');

WITH recent_paid AS (
  SELECT id, order_number, status, payment_status, payment_method, total, currency,
         user_id, customer_name, customer_phone, customer_email, created_at
  FROM public.orders
  WHERE payment_status IN ('paid', 'captured')
    AND created_at > now() - interval '24 hours'
), inserted AS (
  INSERT INTO public.webhook_events(event_type, payload)
  SELECT 'order.paid', jsonb_build_object(
    'order_id', id,
    'order_number', order_number,
    'status', status,
    'payment_status', payment_status,
    'payment_method', payment_method,
    'total', total::text,
    'amount', total::text,
    'order_total', total::text,
    'currency', currency,
    'customer_id', user_id,
    'customer_name', customer_name,
    'customer_phone', customer_phone,
    'customer_email', customer_email,
    'created_at', created_at
  )
  FROM recent_paid rp
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notif_queue q
    WHERE q.related_entity = 'order'
      AND q.related_entity_id = rp.id::text
      AND q.event_code IN ('order_paid', 'admin_new_order')
  )
  RETURNING id
)
SELECT count(*) FROM inserted;