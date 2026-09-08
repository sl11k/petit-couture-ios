-- Reclaim space left by deleted speed samples
CREATE TABLE public.perf_metrics_new (LIKE public.perf_metrics INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
INSERT INTO public.perf_metrics_new SELECT * FROM public.perf_metrics WHERE created_at > now() - interval '1 day';
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

-- Shrink oversized analytics rows: drop tracking query strings and cap long text
UPDATE public.analytics_events
SET path = left(split_part(path, '?', 1), 200),
    referrer = left(coalesce(referrer, ''), 120),
    user_agent = left(coalesce(user_agent, ''), 120)
WHERE length(coalesce(path,'')) > 60 OR length(coalesce(user_agent,'')) > 120 OR length(coalesce(referrer,'')) > 120;

-- Keep new rows small at write time
CREATE OR REPLACE FUNCTION public.analytics_events_trim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.path := left(split_part(coalesce(NEW.path, '/'), '?', 1), 200);
  NEW.referrer := left(NEW.referrer, 120);
  NEW.user_agent := left(NEW.user_agent, 120);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_analytics_events_trim ON public.analytics_events;
CREATE TRIGGER trg_analytics_events_trim BEFORE INSERT ON public.analytics_events
FOR EACH ROW EXECUTE FUNCTION public.analytics_events_trim();