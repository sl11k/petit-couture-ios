DROP FUNCTION IF EXISTS public.claim_oto_shipment_creation(uuid);

CREATE OR REPLACE FUNCTION public.claim_oto_shipment_creation(
  _order_id uuid,
  _force boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claim_oto$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF NOT _force
     AND o.oto_creation_started_at IS NOT NULL
     AND o.oto_creation_error IS NULL
     AND o.oto_creation_started_at > now() - interval '10 minutes'
  THEN
    RETURN false;
  END IF;

  UPDATE public.orders
     SET oto_creation_started_at = now(), oto_creation_error = NULL, updated_at = now()
   WHERE id = _order_id;
  RETURN true;
END;
$claim_oto$;

REVOKE ALL ON FUNCTION public.claim_oto_shipment_creation(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_oto_shipment_creation(uuid, boolean) TO service_role;