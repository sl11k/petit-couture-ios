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
DROP TRIGGER IF EXISTS trg_analytics_events_trim ON public.analytics_events;
CREATE TRIGGER trg_analytics_events_trim BEFORE INSERT ON public.analytics_events
FOR EACH ROW EXECUTE FUNCTION public.analytics_events_trim();