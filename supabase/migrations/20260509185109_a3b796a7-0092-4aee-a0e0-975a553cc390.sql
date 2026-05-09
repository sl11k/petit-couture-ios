
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent','open','click','conversion','bounce','unsubscribe')),
  recipient text,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign_time
  ON public.campaign_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_events_type_time
  ON public.campaign_events(event_type, created_at DESC);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing reads campaign events"
ON public.campaign_events FOR SELECT
USING (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'marketing_manager'::app_role)
);

CREATE POLICY "Authenticated insert campaign events"
ON public.campaign_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
