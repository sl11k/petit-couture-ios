-- 1) Rebuild perf_metrics keeping only the last 3 days (reclaims disk immediately)
CREATE TABLE public.perf_metrics_new (LIKE public.perf_metrics INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
INSERT INTO public.perf_metrics_new SELECT * FROM public.perf_metrics WHERE created_at > now() - interval '3 days';
DROP TABLE public.perf_metrics;
ALTER TABLE public.perf_metrics_new RENAME TO perf_metrics;
ALTER TABLE public.perf_metrics ADD PRIMARY KEY (id);
CREATE INDEX idx_perf_metrics_created ON public.perf_metrics USING btree (created_at DESC);
CREATE INDEX idx_perf_metrics_metric ON public.perf_metrics USING btree (metric, created_at DESC);
GRANT SELECT ON public.perf_metrics TO authenticated;
GRANT INSERT ON public.perf_metrics TO anon, authenticated;
GRANT ALL ON public.perf_metrics TO service_role;
ALTER TABLE public.perf_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read metrics" ON public.perf_metrics FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'reports.view'::text));
CREATE POLICY "Anyone can record metrics" ON public.perf_metrics FOR INSERT WITH CHECK (true);

-- 2) Trim analytics_events to 60 days
DELETE FROM public.analytics_events WHERE created_at < now() - interval '60 days';

-- 3) Trim audit logs to 180 days
DELETE FROM public.audit_logs WHERE created_at < now() - interval '180 days';

-- 4) Nightly automatic cleanup
CREATE OR REPLACE FUNCTION public.purge_telemetry_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.perf_metrics WHERE created_at < now() - interval '3 days';
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '60 days';
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '180 days';
  DELETE FROM public.shipping_webhooks_log WHERE created_at < now() - interval '90 days';
  DELETE FROM public.payment_webhooks_log WHERE created_at < now() - interval '90 days';
END;
$$;
REVOKE ALL ON FUNCTION public.purge_telemetry_logs() FROM public, anon, authenticated;

SELECT cron.schedule('purge-telemetry-logs', '30 2 * * *', $$SELECT public.purge_telemetry_logs();$$);