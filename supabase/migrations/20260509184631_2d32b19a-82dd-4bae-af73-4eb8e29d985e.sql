
CREATE OR REPLACE FUNCTION public.notify_webhook_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ep RECORD;
BEGIN
  -- Only act on transitions into a terminal failed state
  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    SELECT id, name, url, failure_count INTO ep
      FROM public.webhook_endpoints WHERE id = NEW.endpoint_id;

    INSERT INTO public.admin_notifications(event_code, severity, title, body, related_entity, related_entity_id, link, metadata)
    VALUES (
      'webhook.delivery_failed',
      CASE WHEN COALESCE(ep.failure_count,0) >= 5 THEN 'critical' ELSE 'warning' END,
      'فشل تسليم Webhook' || COALESCE(' — ' || ep.name, ''),
      'الحدث: ' || NEW.event_type ||
      ' — المحاولات: ' || NEW.attempt || '/' || NEW.max_attempts ||
      COALESCE(' — كود: ' || NEW.http_status::text, '') ||
      COALESCE(' — خطأ: ' || left(NEW.error_message, 200), ''),
      'webhook_delivery',
      NEW.id::text,
      '/admin/webhooks-health',
      jsonb_build_object(
        'endpoint_id', NEW.endpoint_id,
        'endpoint_name', ep.name,
        'endpoint_url', ep.url,
        'event_type', NEW.event_type,
        'http_status', NEW.http_status,
        'attempt', NEW.attempt,
        'failure_count', ep.failure_count
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_webhook_failure ON public.webhook_deliveries;
CREATE TRIGGER trg_notify_webhook_failure
AFTER INSERT OR UPDATE OF status ON public.webhook_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.notify_webhook_failure();
