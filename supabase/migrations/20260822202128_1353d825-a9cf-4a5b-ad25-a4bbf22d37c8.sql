
-- 1. Recovery function for abandoned carts
CREATE OR REPLACE FUNCTION public.recover_abandoned_carts(_minutes integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.recover_abandoned_carts(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_abandoned_carts(integer) TO service_role;

-- 2. Message templates for abandoned carts
INSERT INTO public.notif_templates(event_code, channel, audience, language, subject, body, is_enabled, is_default)
SELECT 'cart.abandoned', 'whatsapp', 'customer', 'ar', NULL,
E'مرحباً {{customer_name}} 👋\nلاحظنا أنك تركت منتجاتك في السلة قبل إتمام الطلب.\n\nخصصنا لك خصم {{discount}} بكود: *{{coupon_code}}*\nصالح لمدة 48 ساعة فقط ⏰\n\nأكمل طلبك من هنا:\n{{store_url}}\n\nمتجر le petit paradise',
true, true
WHERE NOT EXISTS (SELECT 1 FROM public.notif_templates WHERE event_code='cart.abandoned' AND channel='whatsapp' AND language='ar');

INSERT INTO public.notif_templates(event_code, channel, audience, language, subject, body, is_enabled, is_default)
SELECT 'cart.abandoned', 'whatsapp', 'customer', 'en', NULL,
E'Hi {{customer_name}} 👋\nYou left items in your cart.\n\nHere is a {{discount}} discount just for you: *{{coupon_code}}*\nValid for 48 hours only ⏰\n\nComplete your order here:\n{{store_url}}\n\nle petit paradise',
true, true
WHERE NOT EXISTS (SELECT 1 FROM public.notif_templates WHERE event_code='cart.abandoned' AND channel='whatsapp' AND language='en');

INSERT INTO public.notif_templates(event_code, channel, audience, language, subject, body, is_enabled, is_default)
SELECT 'cart.abandoned', 'email', 'customer', 'ar', 'سلتك بانتظارك — خصم {{discount}} خاص لك',
E'مرحباً {{customer_name}}\n\nتركت منتجاتك في السلة. خصصنا لك خصم {{discount}} بكود {{coupon_code}} صالح 48 ساعة.\n\nأكمل طلبك: {{store_url}}',
true, true
WHERE NOT EXISTS (SELECT 1 FROM public.notif_templates WHERE event_code='cart.abandoned' AND channel='email' AND language='ar');

-- 3. Release stock held by stale unpaid orders and cancel them
UPDATE public.orders
   SET expires_at = created_at + interval '15 minutes'
 WHERE expires_at IS NULL
   AND status = 'pending'
   AND payment_status IN ('unpaid','failed','pending_review');

SELECT public.auto_cancel_expired_orders();

-- 4. Cron jobs
SELECT cron.unschedule('auto-cancel-expired-orders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-cancel-expired-orders');
SELECT cron.schedule('auto-cancel-expired-orders', '* * * * *', $$SELECT public.auto_cancel_expired_orders();$$);

SELECT cron.unschedule('recover-abandoned-carts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='recover-abandoned-carts');
SELECT cron.schedule('recover-abandoned-carts', '*/5 * * * *', $$SELECT public.recover_abandoned_carts(15);$$);
