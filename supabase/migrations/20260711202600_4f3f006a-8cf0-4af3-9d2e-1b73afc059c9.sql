
-- ============================================================================
-- Unified notification enqueuer
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _event_code text,
  _audience text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _related_entity text DEFAULT NULL,
  _related_entity_id text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _language text DEFAULT 'ar'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
  ch text;
  tpl RECORD;
  body_rendered text;
  subj_rendered text;
  dedupe text;
  p_phone text := _phone;
  p_email text := _email;
  p_name  text := NULL;
BEGIN
  -- Enrich recipient from profile if we only have user_id
  IF _user_id IS NOT NULL AND (p_phone IS NULL OR p_email IS NULL) THEN
    SELECT COALESCE(p_phone, phone), COALESCE(p_email, email), full_name
      INTO p_phone, p_email, p_name
      FROM public.profiles WHERE user_id = _user_id;
  END IF;

  SELECT * INTO r FROM public.notification_rules
   WHERE event_code = _event_code AND audience = _audience AND is_enabled = true
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF r.trigger_mode <> 'auto' THEN RETURN; END IF;

  FOR ch IN SELECT jsonb_array_elements_text(r.channels) LOOP
    -- Render template if available
    body_rendered := NULL; subj_rendered := NULL;
    SELECT subject, body INTO tpl.subject, tpl.body FROM public.notification_templates
      WHERE event_code = _event_code AND audience = _audience
        AND channel = ch AND language = _language AND is_enabled = true
      LIMIT 1;
    IF tpl.body IS NOT NULL THEN
      body_rendered := tpl.body;
      subj_rendered := tpl.subject;
    END IF;

    dedupe := _event_code || ':' || _audience || ':' || ch || ':' ||
              COALESCE(_related_entity_id, gen_random_uuid()::text);

    IF ch = 'in_app' THEN
      IF _audience = 'admin' THEN
        INSERT INTO public.admin_notifications(
          event_code, severity, title, body, related_entity, related_entity_id, link, metadata
        ) VALUES (
          _event_code,
          CASE WHEN _event_code ILIKE '%fail%' OR _event_code ILIKE '%error%' OR _event_code ILIKE '%out_of_stock%' THEN 'warning'
               WHEN _event_code ILIKE 'admin_new%' OR _event_code ILIKE '%paid%' OR _event_code ILIKE '%delivered%' THEN 'success'
               ELSE 'info' END,
          COALESCE(subj_rendered, _event_code),
          COALESCE(body_rendered, _event_code),
          _related_entity, _related_entity_id,
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

    -- whatsapp / sms / email → queue
    IF ch IN ('whatsapp','sms') AND (p_phone IS NULL OR length(p_phone) < 6) THEN CONTINUE; END IF;
    IF ch = 'email' AND (p_email IS NULL OR p_email = '') THEN CONTINUE; END IF;

    INSERT INTO public.notif_queue(
      event_code, audience, channel, recipient_phone, recipient_email,
      recipient_user_id, language, payload, rendered_body,
      scheduled_at, dedupe_key, related_entity, related_entity_id, max_attempts
    ) VALUES (
      _event_code, _audience, ch, p_phone, p_email,
      _user_id, _language, _payload, body_rendered,
      now() + make_interval(mins => COALESCE(r.delay_minutes, 0)),
      dedupe, _related_entity, _related_entity_id, COALESCE(r.max_retries, 3)
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Never break the parent transaction because of notifications
  RAISE WARNING 'enqueue_notification failed for %/%: %', _event_code, _audience, SQLERRM;
END;
$$;

-- Add unique constraint on dedupe_key so ON CONFLICT works
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'notif_queue_dedupe_uniq') THEN
    CREATE UNIQUE INDEX notif_queue_dedupe_uniq ON public.notif_queue(dedupe_key) WHERE dedupe_key IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Bridge: webhook_events → notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION public.webhook_events_to_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p jsonb := NEW.payload;
  et text := NEW.event_type;
  cust_id uuid := NULLIF(p->>'customer_id','')::uuid;
  order_id text := p->>'order_id';
  order_num text := p->>'order_number';
  cust_email text := p->>'email';
BEGIN
  IF et = 'order.created' THEN
    PERFORM public.enqueue_notification('order_created', 'customer', p, 'order', order_id, cust_id);
    PERFORM public.enqueue_notification('admin_new_order', 'admin', p, 'order', order_id);
  ELSIF et = 'order.paid' THEN
    PERFORM public.enqueue_notification('order_paid', 'customer', p, 'order', order_id, cust_id);
    PERFORM public.enqueue_notification('payment_received', 'customer', p, 'order', order_id, cust_id);
  ELSIF et = 'order.shipped' THEN
    PERFORM public.enqueue_notification('order_shipped', 'customer', p, 'order', order_id, cust_id);
  ELSIF et = 'order.delivered' THEN
    PERFORM public.enqueue_notification('order_delivered', 'customer', p, 'order', order_id, cust_id);
    PERFORM public.enqueue_notification('order_completed', 'customer', p, 'order', order_id, cust_id);
  ELSIF et = 'order.cancelled' THEN
    PERFORM public.enqueue_notification('order_cancelled_by_admin', 'customer', p, 'order', order_id, cust_id);
  ELSIF et = 'customer.created' THEN
    PERFORM public.enqueue_notification('welcome', 'customer', p, 'customer', cust_id::text, cust_id, NULL, cust_email);
    PERFORM public.enqueue_notification('admin_new_customer', 'admin', p, 'customer', cust_id::text);
  ELSIF et = 'inventory.low' THEN
    PERFORM public.enqueue_notification('admin_low_stock', 'admin', p, 'product', p->>'product_id');
    IF (p->>'stock')::int = 0 THEN
      PERFORM public.enqueue_notification('admin_out_of_stock', 'admin', p, 'product', p->>'product_id');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_events_notify ON public.webhook_events;
CREATE TRIGGER trg_webhook_events_notify
AFTER INSERT ON public.webhook_events
FOR EACH ROW EXECUTE FUNCTION public.webhook_events_to_notifications();

-- ============================================================================
-- Return requests
-- ============================================================================
CREATE OR REPLACE FUNCTION public.return_requests_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p jsonb;
BEGIN
  p := jsonb_build_object(
    'return_id', NEW.id, 'return_number', NEW.return_number,
    'order_id', NEW.order_id, 'order_number', NEW.order_number,
    'reason', NEW.reason, 'status', NEW.status
  );
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_notification('return_requested', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    PERFORM public.enqueue_notification('admin_new_return', 'admin', p, 'return', NEW.id::text);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.enqueue_notification('return_approved', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.enqueue_notification('return_rejected', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    ELSIF NEW.status = 'awaiting_pickup' THEN
      PERFORM public.enqueue_notification('return_pickup_scheduled', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    ELSIF NEW.status = 'received' THEN
      PERFORM public.enqueue_notification('return_received', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    ELSIF NEW.status = 'refunded' THEN
      PERFORM public.enqueue_notification('return_refunded', 'customer', p, 'return', NEW.id::text, NEW.user_id);
      PERFORM public.enqueue_notification('payment_refunded', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    ELSIF NEW.status = 'closed' THEN
      PERFORM public.enqueue_notification('return_closed', 'customer', p, 'return', NEW.id::text, NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_return_requests_notify ON public.return_requests;
CREATE TRIGGER trg_return_requests_notify
AFTER INSERT OR UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.return_requests_notify();

-- ============================================================================
-- Support tickets
-- ============================================================================
CREATE OR REPLACE FUNCTION public.support_tickets_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb;
BEGIN
  p := jsonb_build_object('ticket_id', NEW.id, 'subject', NEW.subject, 'status', NEW.status);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_notification('support_ticket_created', 'customer', p, 'ticket', NEW.id::text, NEW.user_id);
    PERFORM public.enqueue_notification('admin_new_ticket', 'admin', p, 'ticket', NEW.id::text);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'resolved' THEN
      PERFORM public.enqueue_notification('support_ticket_resolved', 'customer', p, 'ticket', NEW.id::text, NEW.user_id);
    ELSIF NEW.status = 'waiting_customer' AND OLD.status <> 'new' THEN
      PERFORM public.enqueue_notification('support_ticket_replied', 'customer', p, 'ticket', NEW.id::text, NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_support_tickets_notify ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_notify
AFTER INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_tickets_notify();

-- Ticket messages: reply notifications
CREATE OR REPLACE FUNCTION public.support_messages_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb; t RECORD;
BEGIN
  IF NEW.is_internal_note = true THEN RETURN NEW; END IF;
  SELECT id, user_id, subject INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  p := jsonb_build_object('ticket_id', t.id, 'subject', t.subject, 'message', LEFT(NEW.body, 200));
  IF NEW.direction = 'staff' THEN
    PERFORM public.enqueue_notification('support_ticket_replied', 'customer', p, 'ticket', t.id::text, t.user_id);
  ELSIF NEW.direction = 'customer' THEN
    PERFORM public.enqueue_notification('support_new_message', 'admin', p, 'ticket', t.id::text);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_support_messages_notify ON public.support_ticket_messages;
CREATE TRIGGER trg_support_messages_notify
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.support_messages_notify();

-- ============================================================================
-- Reviews
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reviews_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb;
BEGIN
  p := jsonb_build_object('review_id', NEW.id, 'product_id', NEW.product_id, 'rating', NEW.rating, 'title', NEW.title);
  PERFORM public.enqueue_notification('admin_review_new', 'admin', p, 'review', NEW.id::text);
  IF NEW.rating IS NOT NULL AND NEW.rating <= 2 THEN
    PERFORM public.enqueue_notification('admin_review_low_rating', 'admin', p, 'review', NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reviews_notify ON public.reviews;
CREATE TRIGGER trg_reviews_notify
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reviews_notify();

-- ============================================================================
-- Coupon redemptions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.coupon_redemptions_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb;
BEGIN
  p := jsonb_build_object('coupon_id', NEW.coupon_id, 'order_id', NEW.order_id);
  PERFORM public.enqueue_notification('coupon_used', 'customer', p, 'coupon', NEW.coupon_id::text, NEW.user_id, NULL, NEW.customer_email);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_coupon_redemptions_notify ON public.coupon_redemptions;
CREATE TRIGGER trg_coupon_redemptions_notify
AFTER INSERT ON public.coupon_redemptions
FOR EACH ROW EXECUTE FUNCTION public.coupon_redemptions_notify();

-- ============================================================================
-- Payment refunds
-- ============================================================================
CREATE OR REPLACE FUNCTION public.payment_refunds_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb; o RECORD;
BEGIN
  SELECT id, user_id, order_number, total, currency INTO o FROM public.orders WHERE id = NEW.order_id;
  p := jsonb_build_object('refund_id', NEW.id, 'order_id', NEW.order_id, 'order_number', o.order_number,
                          'amount', NEW.amount, 'currency', COALESCE(NEW.currency, o.currency));
  PERFORM public.enqueue_notification('payment_refunded', 'customer', p, 'refund', NEW.id::text, o.user_id);
  PERFORM public.enqueue_notification('admin_refund_requested', 'admin', p, 'refund', NEW.id::text);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_payment_refunds_notify ON public.payment_refunds;
CREATE TRIGGER trg_payment_refunds_notify
AFTER INSERT ON public.payment_refunds
FOR EACH ROW EXECUTE FUNCTION public.payment_refunds_notify();

-- ============================================================================
-- Shipments status transitions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.shipments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb; o RECORD; code text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    code := 'shipment_created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    code := CASE NEW.status
      WHEN 'picked_up' THEN 'picked_up'
      WHEN 'in_transit' THEN 'in_transit'
      WHEN 'out_for_delivery' THEN 'out_for_delivery'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'failed' THEN 'delivery_attempted'
      WHEN 'returned' THEN 'returned_to_sender'
      ELSE NULL END;
  END IF;
  IF code IS NULL THEN RETURN NEW; END IF;

  SELECT user_id, order_number INTO o FROM public.orders WHERE id = NEW.order_id;
  p := jsonb_build_object(
    'shipment_id', NEW.id, 'order_id', NEW.order_id, 'order_number', o.order_number,
    'tracking_number', NEW.tracking_number, 'tracking_url', NEW.tracking_url,
    'carrier', NEW.carrier_code, 'status', NEW.status
  );
  PERFORM public.enqueue_notification(code, 'customer', p, 'shipment', NEW.id::text, o.user_id);
  IF code IN ('delivery_attempted','returned_to_sender') THEN
    PERFORM public.enqueue_notification('admin_shipment_failed', 'admin', p, 'shipment', NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_shipments_notify ON public.shipments;
CREATE TRIGGER trg_shipments_notify
AFTER INSERT OR UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.shipments_notify();

-- ============================================================================
-- Account lockouts (already inserts admin_notifications; add customer WhatsApp)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.account_lockouts_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE u RECORD; p jsonb;
BEGIN
  SELECT id, email INTO u FROM auth.users WHERE email = NEW.email LIMIT 1;
  p := jsonb_build_object('email', NEW.email, 'locked_until', NEW.locked_until, 'reason', NEW.reason);
  PERFORM public.enqueue_notification('account_locked', 'customer', p, 'lockout', NEW.id::text, u.id, NULL, NEW.email);
  PERFORM public.enqueue_notification('login_suspicious', 'customer', p, 'lockout', NEW.id::text, u.id, NULL, NEW.email);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_account_lockouts_notify ON public.account_lockouts;
CREATE TRIGGER trg_account_lockouts_notify
AFTER INSERT ON public.account_lockouts
FOR EACH ROW EXECUTE FUNCTION public.account_lockouts_notify();

-- ============================================================================
-- Abandoned carts (mark_abandoned handled elsewhere; trigger on status transition)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.abandoned_carts_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p jsonb;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status='abandoned') THEN
    p := jsonb_build_object('cart_id', NEW.id, 'total', NEW.total, 'items_count', NEW.items_count);
    PERFORM public.enqueue_notification('cart_abandoned_1h', 'customer', p, 'abandoned_cart', NEW.id::text, NEW.user_id, NEW.phone, NEW.email);
    IF NEW.total IS NOT NULL AND NEW.total >= 500 THEN
      PERFORM public.enqueue_notification('admin_abandoned_cart_high_value', 'admin', p, 'abandoned_cart', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_abandoned_carts_notify ON public.abandoned_carts;
CREATE TRIGGER trg_abandoned_carts_notify
AFTER INSERT OR UPDATE ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.abandoned_carts_notify();
