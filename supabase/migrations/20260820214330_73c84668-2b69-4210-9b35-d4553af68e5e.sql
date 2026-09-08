-- Reclaim bloat and tighten telemetry retention
CREATE TABLE public.analytics_events_new (LIKE public.analytics_events INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
INSERT INTO public.analytics_events_new SELECT * FROM public.analytics_events WHERE created_at > now() - interval '60 days';
DROP TABLE public.analytics_events;
ALTER TABLE public.analytics_events_new RENAME TO analytics_events;
ALTER TABLE public.analytics_events ADD PRIMARY KEY (id);
CREATE INDEX idx_events_created ON public.analytics_events USING btree (created_at DESC);
CREATE INDEX idx_events_name ON public.analytics_events USING btree (event_name, created_at DESC);
CREATE INDEX idx_events_session ON public.analytics_events USING btree (session_id);
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read events" ON public.analytics_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY "Anyone insert events" ON public.analytics_events FOR INSERT WITH CHECK (true);

-- Speed metrics: keep only 24h of samples
DELETE FROM public.perf_metrics WHERE created_at < now() - interval '1 day';

CREATE OR REPLACE FUNCTION public.purge_telemetry_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.perf_metrics WHERE created_at < now() - interval '1 day';
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '60 days';
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '180 days';
  DELETE FROM public.shipping_webhooks_log WHERE created_at < now() - interval '90 days';
  DELETE FROM public.payment_webhooks_log WHERE created_at < now() - interval '90 days';
END;
$$;
REVOKE ALL ON FUNCTION public.purge_telemetry_logs() FROM public, anon, authenticated;

SELECT cron.unschedule('purge-telemetry-logs');
SELECT cron.schedule('purge-telemetry-logs', '0 */6 * * *', $$SELECT public.purge_telemetry_logs();$$);