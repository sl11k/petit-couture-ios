ALTER TABLE public.notif_queue
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terminal_at timestamptz;
ALTER TABLE public.notif_delivery_logs
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS notif_queue_provider_message_id_uniq ON public.notif_queue(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notif_queue_whatsapp_dispatch_idx ON public.notif_queue(channel,status,scheduled_at,priority) WHERE channel='whatsapp';
CREATE INDEX IF NOT EXISTS notif_delivery_logs_provider_message_id_idx ON public.notif_delivery_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;
UPDATE public.notif_queue SET status='sent_unconfirmed',last_error=COALESCE(last_error,'Historical provider acceptance was not recorded'),updated_at=now() WHERE channel='whatsapp' AND status='sent' AND provider_message_id IS NULL AND delivered_at IS NULL AND read_at IS NULL;
UPDATE public.notif_delivery_logs SET status='sent_unconfirmed',error_code=COALESCE(error_code,'historical_provider_id_missing'),error_message=COALESCE(error_message,'Historical provider acceptance was not recorded') WHERE channel='whatsapp' AND status='sent' AND provider_message_id IS NULL AND delivered_at IS NULL AND read_at IS NULL;
UPDATE public.notification_log SET status='manual_link',metadata=COALESCE(metadata,'{}'::jsonb)||'{"delivery_mode":"manual_wa_link","provider_accepted":false}'::jsonb,error_message=COALESCE(error_message,'Manual WhatsApp link opened; API delivery was not attempted') WHERE channel='whatsapp' AND status='sent';
UPDATE public.notif_queue SET status='queued' WHERE status IN ('pending','retry');
UPDATE public.notif_queue SET status='queued',locked_at=NULL,locked_by=NULL WHERE status='processing' AND locked_at < now()-interval '5 minutes';
UPDATE public.notif_queue SET status='sending' WHERE status='processing';
ALTER TABLE public.notif_queue DROP CONSTRAINT IF EXISTS notif_queue_status_check;
ALTER TABLE public.notif_queue ADD CONSTRAINT notif_queue_status_check CHECK (status IN ('queued','sending','sent','delivered','read','failed','dead_letter','sent_unconfirmed','manual_link','cancelled'));
ALTER TABLE public.notif_delivery_logs DROP CONSTRAINT IF EXISTS notif_delivery_logs_status_check;
ALTER TABLE public.notif_delivery_logs ADD CONSTRAINT notif_delivery_logs_status_check CHECK (status IN ('sending','sent','delivered','read','failed','dead_letter','sent_unconfirmed','manual_link'));
CREATE TABLE IF NOT EXISTS public.notif_provider_webhook_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE, provider_code text NOT NULL,
 provider_message_id text, provider_status text, provider_timestamp timestamptz, signature_valid boolean NOT NULL DEFAULT false,
 sanitized_payload jsonb NOT NULL DEFAULT '{}'::jsonb, processing_error text, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
GRANT SELECT ON public.notif_provider_webhook_events TO authenticated;
GRANT ALL ON public.notif_provider_webhook_events TO service_role;
ALTER TABLE public.notif_provider_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read WhatsApp webhook events" ON public.notif_provider_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE OR REPLACE FUNCTION public.apply_whatsapp_provider_status(_event_key text,_provider_code text,_provider_message_id text,_status text,_provider_timestamp timestamptz,_signature_valid boolean,_sanitized_payload jsonb DEFAULT '{}'::jsonb,_error_code text DEFAULT NULL,_error_message text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.notif_queue%ROWTYPE; incoming_rank integer; current_rank integer;
BEGIN
 INSERT INTO public.notif_provider_webhook_events(event_key,provider_code,provider_message_id,provider_status,provider_timestamp,signature_valid,sanitized_payload) VALUES(_event_key,_provider_code,_provider_message_id,_status,_provider_timestamp,_signature_valid,COALESCE(_sanitized_payload,'{}'::jsonb)) ON CONFLICT(event_key) DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT _signature_valid THEN RETURN false; END IF;
 SELECT * INTO q FROM public.notif_queue WHERE provider_message_id=_provider_message_id FOR UPDATE;
 IF NOT FOUND THEN UPDATE public.notif_provider_webhook_events SET processing_error='message_not_found',processed_at=now() WHERE event_key=_event_key; RETURN false; END IF;
 incoming_rank:=CASE _status WHEN 'sent' THEN 3 WHEN 'delivered' THEN 4 WHEN 'read' THEN 5 ELSE -1 END;
 current_rank:=CASE q.status WHEN 'sent' THEN 3 WHEN 'delivered' THEN 4 WHEN 'read' THEN 5 ELSE 0 END;
 IF _status='failed' AND q.status NOT IN ('delivered','read') THEN
  UPDATE public.notif_queue SET status='failed',failed_at=COALESCE(_provider_timestamp,now()),provider_status_at=COALESCE(_provider_timestamp,now()),error_code=_error_code,last_error=left(COALESCE(_error_message,'Provider reported delivery failure'),500),terminal_at=COALESCE(_provider_timestamp,now()),updated_at=now() WHERE id=q.id;
 ELSIF incoming_rank>=current_rank THEN
  UPDATE public.notif_queue SET status=_status,delivered_at=CASE WHEN _status IN ('delivered','read') THEN COALESCE(delivered_at,_provider_timestamp,now()) ELSE delivered_at END,read_at=CASE WHEN _status='read' THEN COALESCE(read_at,_provider_timestamp,now()) ELSE read_at END,provider_status_at=COALESCE(_provider_timestamp,now()),terminal_at=CASE WHEN _status='read' THEN COALESCE(_provider_timestamp,now()) ELSE terminal_at END,updated_at=now() WHERE id=q.id;
 END IF;
 UPDATE public.notif_delivery_logs SET status=(SELECT status FROM public.notif_queue WHERE id=q.id),delivered_at=(SELECT delivered_at FROM public.notif_queue WHERE id=q.id),read_at=(SELECT read_at FROM public.notif_queue WHERE id=q.id),failed_at=(SELECT failed_at FROM public.notif_queue WHERE id=q.id),provider_status_at=(SELECT provider_status_at FROM public.notif_queue WHERE id=q.id),error_code=(SELECT error_code FROM public.notif_queue WHERE id=q.id),error_message=(SELECT last_error FROM public.notif_queue WHERE id=q.id) WHERE queue_id=q.id AND provider_message_id=_provider_message_id;
 UPDATE public.notif_provider_webhook_events SET processed_at=now() WHERE event_key=_event_key;
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.apply_whatsapp_provider_status(text,text,text,text,timestamptz,boolean,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_provider_status(text,text,text,text,timestamptz,boolean,jsonb,text,text) TO service_role;