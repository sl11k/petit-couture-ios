
-- Helper: has this contact already been messaged recently?
CREATE OR REPLACE FUNCTION public.recovery_recently_contacted(_phone text, _email text, _days integer DEFAULT 30)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.abandoned_carts ac
     WHERE COALESCE(ac.contact_attempts,0) > 0
       AND ac.last_contacted_at IS NOT NULL
       AND ac.last_contacted_at > now() - make_interval(days => _days)
       AND (
            (_phone IS NOT NULL AND ac.phone IS NOT NULL
              AND regexp_replace(ac.phone,'[^0-9]','','g') = regexp_replace(_phone,'[^0-9]','','g'))
         OR (_email IS NOT NULL AND ac.email IS NOT NULL
              AND lower(ac.email) = lower(_email))
       )
  )
$$;

REVOKE ALL ON FUNCTION public.recovery_recently_contacted(text,text,integer) FROM PUBLIC, anon, authenticated;

-- Expired-order win-back: only once per contact per 30 days
CREATE OR REPLACE FUNCTION public.auto_cancel_expired_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    BEGIN
      IF (o.customer_phone IS NOT NULL OR o.customer_email IS NOT NULL)
         AND NOT public.recovery_recently_contacted(o.customer_phone, o.customer_email, 30) THEN
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
$function$;

-- Abandoned cart cron: only once per contact per 30 days
CREATE OR REPLACE FUNCTION public.recover_abandoned_carts(_minutes integer DEFAULT 15)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  v_code text;
  v_token text;
  v_link text;
  n integer := 0;
BEGIN
  FOR c IN
    SELECT * FROM public.abandoned_carts
     WHERE converted = false
       AND COALESCE(contact_attempts,0) = 0
       AND updated_at < now() - make_interval(mins => _minutes)
       AND updated_at > now() - interval '7 days'
       AND COALESCE(subtotal,0) > 0
       AND (phone IS NOT NULL OR email IS NOT NULL)
     ORDER BY updated_at
     LIMIT 25
  LOOP
    IF public.recovery_recently_contacted(c.phone, c.email, 30) THEN
      UPDATE public.abandoned_carts
         SET contact_attempts = COALESCE(contact_attempts,0) + 1,
             contact_status = 'skipped_duplicate'
       WHERE id = c.id;
      CONTINUE;
    END IF;

    v_token := COALESCE(c.recovery_token, encode(gen_random_bytes(16),'hex'));
    v_code  := COALESCE(c.recovery_coupon_code, 'BACK10' || upper(substr(md5(random()::text),1,6)));

    IF NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = v_code) THEN
      INSERT INTO public.coupons(code, name, description, discount_type, discount_value,
                                 max_uses, per_customer_limit, expires_at, is_active)
      VALUES (v_code, 'خصم سلة متروكة', 'خصم خاص لاستكمال الطلب', 'percent', 10, 1, 1,
              now() + interval '48 hours', true);
    END IF;

    v_link := 'https://lppme.com/recover/' || v_token;

    BEGIN
      PERFORM public.enqueue_notification(
        _event_code => 'cart.abandoned',
        _audience   => 'customer',
        _payload    => jsonb_build_object(
                          'customer_name', COALESCE(NULLIF(split_part(COALESCE(c.email,''),'@',1),''), 'عميلنا العزيز'),
                          'store_url', v_link,
                          'recovery_url', v_link,
                          'coupon_code', v_code,
                          'discount', '10%',
                          'cart_total', COALESCE(c.subtotal,0),
                          'currency', COALESCE(c.currency,'SAR')),
        _related_entity    => 'abandoned_cart',
        _related_entity_id => c.id::text,
        _user_id  => c.user_id,
        _phone    => c.phone,
        _email    => c.email,
        _language => 'ar');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    UPDATE public.abandoned_carts
       SET recovery_token = v_token,
           recovery_coupon_code = v_code,
           contact_attempts = COALESCE(contact_attempts,0) + 1,
           last_contacted_at = now(),
           contact_status = 'sent'
     WHERE id = c.id;

    INSERT INTO public.cart_recovery_attempts(cart_id, channel, status, coupon_code, message, metadata)
    VALUES (c.id,
            CASE WHEN c.phone IS NOT NULL THEN 'whatsapp' ELSE 'email' END,
            'queued', v_code, v_link, jsonb_build_object('auto', true));

    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;
