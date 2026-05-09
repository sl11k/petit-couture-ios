
-- 1) Notify admins when an account gets locked (repeated failed logins)
CREATE OR REPLACE FUNCTION public.notify_account_lockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications(event_code, severity, title, body, related_entity, related_entity_id, link, metadata)
  VALUES (
    'security.account_locked',
    'warning',
    'تم قفل حساب بسبب محاولات دخول فاشلة',
    'الحساب: ' || NEW.email || ' — عدد المحاولات: ' || NEW.failed_count || ' — مقفل حتى ' || to_char(NEW.locked_until, 'YYYY-MM-DD HH24:MI'),
    'account_lockout',
    NEW.id::text,
    '/admin/audit-logins',
    jsonb_build_object(
      'email', NEW.email,
      'failed_count', NEW.failed_count,
      'locked_until', NEW.locked_until,
      'reason', NEW.reason
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_account_lockout ON public.account_lockouts;
CREATE TRIGGER trg_notify_account_lockout
AFTER INSERT ON public.account_lockouts
FOR EACH ROW EXECUTE FUNCTION public.notify_account_lockout();

-- 2) Scan & notify shipping delays (idempotent per order/event)
CREATE OR REPLACE FUNCTION public.notify_shipping_delays(
  _pending_threshold_hours integer DEFAULT 48,
  _intransit_threshold_days integer DEFAULT 7
)
RETURNS TABLE(notified integer, kind text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int := 0;
  v_intransit int := 0;
  o RECORD;
BEGIN
  -- A) Paid orders not shipped within threshold
  FOR o IN
    SELECT id, order_number, created_at, payment_status, status, shipping_status
    FROM public.orders
    WHERE payment_status = 'paid'
      AND status IN ('processing','pending','confirmed')
      AND COALESCE(shipping_status,'not_created') IN ('not_created','pending','created')
      AND created_at < now() - (_pending_threshold_hours || ' hours')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.admin_notifications n
        WHERE n.event_code = 'shipping.delayed_dispatch'
          AND n.related_entity = 'order'
          AND n.related_entity_id = (
            SELECT id::text FROM public.orders WHERE id = (SELECT id FROM public.orders WHERE id = o.id)
          )
      )
  LOOP
    INSERT INTO public.admin_notifications(event_code, severity, title, body, related_entity, related_entity_id, link, metadata)
    VALUES (
      'shipping.delayed_dispatch',
      'warning',
      'تأخر في شحن الطلب ' || o.order_number,
      'لم يتم شحن الطلب بعد مرور ' || _pending_threshold_hours || ' ساعة من إنشائه',
      'order', o.id::text,
      '/admin/orders/' || o.id::text,
      jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'threshold_hours', _pending_threshold_hours)
    );
    v_pending := v_pending + 1;
  END LOOP;

  -- B) Shipments in transit for too long
  FOR o IN
    SELECT id, order_number, shipping_status, updated_at
    FROM public.orders
    WHERE COALESCE(shipping_status,'') IN ('in_transit','shipped','out_for_delivery')
      AND updated_at < now() - (_intransit_threshold_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.admin_notifications n
        WHERE n.event_code = 'shipping.delayed_delivery'
          AND n.related_entity = 'order'
          AND n.related_entity_id = (SELECT id::text FROM public.orders WHERE id = o.id)
      )
  LOOP
    INSERT INTO public.admin_notifications(event_code, severity, title, body, related_entity, related_entity_id, link, metadata)
    VALUES (
      'shipping.delayed_delivery',
      'critical',
      'تأخر في تسليم الطلب ' || o.order_number,
      'الشحنة في حالة "' || o.shipping_status || '" منذ أكثر من ' || _intransit_threshold_days || ' أيام',
      'order', o.id::text,
      '/admin/orders/' || o.id::text,
      jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'shipping_status', o.shipping_status)
    );
    v_intransit := v_intransit + 1;
  END LOOP;

  RETURN QUERY SELECT v_pending, 'delayed_dispatch'::text
  UNION ALL SELECT v_intransit, 'delayed_delivery'::text;
END;
$$;
