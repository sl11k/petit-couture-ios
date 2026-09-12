REVOKE ALL ON FUNCTION public.notif_provider_health_set_checked_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notif_provider_health_set_checked_at() FROM anon;
REVOKE ALL ON FUNCTION public.notif_provider_health_set_checked_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notif_provider_health_set_checked_at() TO service_role;