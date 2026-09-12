DROP TRIGGER IF EXISTS trg_notif_provider_health_touch ON public.notif_provider_health;

CREATE OR REPLACE FUNCTION public.notif_provider_health_set_checked_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.checked_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notif_provider_health_touch
BEFORE UPDATE ON public.notif_provider_health
FOR EACH ROW
EXECUTE FUNCTION public.notif_provider_health_set_checked_at();