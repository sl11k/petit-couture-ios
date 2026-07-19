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

        IF NOT EXISTS (SELECT 1 FROM public.notif_queue WHERE dedupe_key = dedupe) THEN
          INSERT INTO public.notif_queue(
            event_code, audience, channel, recipient_phone, recipient_email,
            recipient_user_id, language, payload, rendered_body,
            scheduled_at, dedupe_key, related_entity, related_entity_id, max_attempts
          ) VALUES (
            _event_code, _audience, ch, admin_rec.phone, admin_rec.email,
            NULL, _language, _payload, body_rendered,
            base_scheduled + make_interval(secs => admin_idx * 10),
            dedupe, _related_entity, _related_entity_id, COALESCE(r.max_retries, 3)
          );
        END IF;

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

      IF NOT EXISTS (SELECT 1 FROM public.notif_queue WHERE dedupe_key = dedupe) THEN
        INSERT INTO public.notif_queue(
          event_code, audience, channel, recipient_phone, recipient_email,
          recipient_user_id, language, payload, rendered_body,
          scheduled_at, dedupe_key, related_entity, related_entity_id, max_attempts
        ) VALUES (
          _event_code, _audience, ch, p_phone, p_email,
          _user_id, _language, _payload, body_rendered,
          base_scheduled, dedupe, _related_entity, _related_entity_id, COALESCE(r.max_retries, 3)
        );
      END IF;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_notification failed for %/%: %', _event_code, _audience, SQLERRM;
END;
$$;

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