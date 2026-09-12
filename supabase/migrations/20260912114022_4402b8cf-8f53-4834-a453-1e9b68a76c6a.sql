CREATE TABLE public.meta_capi_events (
  event_id text PRIMARY KEY,
  event_name text NOT NULL CHECK (event_name IN ('PageView','ViewContent','Search','AddToCart','InitiateCheckout','AddPaymentInfo','Purchase')),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','retry','failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  order_id uuid NULL,
  provider_events_received integer NULL,
  http_status integer NULL,
  error_code text NULL,
  error_message text NULL,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_capi_events TO service_role;
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meta_capi_events_status_attempt ON public.meta_capi_events(status, last_attempt_at);
CREATE INDEX idx_meta_capi_events_order ON public.meta_capi_events(order_id) WHERE order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.set_meta_capi_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_meta_capi_events_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_meta_capi_events_updated_at() TO service_role;
CREATE TRIGGER trg_meta_capi_events_updated_at
BEFORE UPDATE ON public.meta_capi_events
FOR EACH ROW EXECUTE FUNCTION public.set_meta_capi_events_updated_at();