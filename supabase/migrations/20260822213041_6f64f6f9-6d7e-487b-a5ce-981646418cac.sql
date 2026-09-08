CREATE OR REPLACE FUNCTION public.track_cart(
  _session_id text,
  _items jsonb,
  _subtotal numeric,
  _currency text DEFAULT 'SAR',
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _reached_checkout boolean DEFAULT false,
  _stage text DEFAULT 'cart'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_session_id text;
BEGIN
  IF _session_id IS NULL OR trim(_session_id) = '' OR _session_id = 'ssr' THEN RETURN; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RETURN; END IF;

  effective_session_id := _session_id;
  IF EXISTS (SELECT 1 FROM public.abandoned_carts WHERE session_id = effective_session_id AND converted = true) THEN
    effective_session_id := _session_id || '-' || floor(extract(epoch from now()) / 900)::bigint::text;
  END IF;

  INSERT INTO public.abandoned_carts AS ac (
    session_id, user_id, email, phone, items, subtotal, currency,
    reached_checkout, converted, stage, source, created_at, updated_at
  ) VALUES (
    effective_session_id, auth.uid(), NULLIF(trim(_email), ''), NULLIF(trim(_phone), ''),
    _items, GREATEST(COALESCE(_subtotal, 0), 0), COALESCE(NULLIF(_currency, ''), 'SAR'),
    COALESCE(_reached_checkout, false), false,
    CASE WHEN _stage IN ('cart','checkout','payment') THEN _stage ELSE 'cart' END,
    'storefront', now(), now()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, ac.user_id),
    email = COALESCE(EXCLUDED.email, ac.email),
    phone = COALESCE(EXCLUDED.phone, ac.phone),
    items = EXCLUDED.items,
    subtotal = EXCLUDED.subtotal,
    currency = EXCLUDED.currency,
    reached_checkout = ac.reached_checkout OR EXCLUDED.reached_checkout,
    stage = CASE
      WHEN ac.stage = 'payment' OR EXCLUDED.stage = 'payment' THEN 'payment'
      WHEN ac.stage = 'checkout' OR EXCLUDED.stage = 'checkout' THEN 'checkout'
      ELSE 'cart'
    END,
    source = EXCLUDED.source,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.track_cart(text, jsonb, numeric, text, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_cart(text, jsonb, numeric, text, text, text, boolean, text) TO anon, authenticated, service_role;