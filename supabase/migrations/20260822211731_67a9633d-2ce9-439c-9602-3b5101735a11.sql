-- Missing privileges: the Data API could never write cart snapshots.
GRANT SELECT ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;

-- Secure write path for guests + signed-in shoppers (no direct table access).
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
SET search_path TO 'public'
AS $$
BEGIN
  IF _session_id IS NULL OR _session_id = '' OR _session_id = 'ssr' THEN
    RETURN;
  END IF;
  IF _items IS NULL OR jsonb_array_length(COALESCE(_items, '[]'::jsonb)) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.abandoned_carts AS ac (
    session_id, user_id, email, phone, items, subtotal, currency,
    reached_checkout, converted, stage, source, first_seen_at, created_at, updated_at
  ) VALUES (
    _session_id, auth.uid(), NULLIF(_email,''), NULLIF(_phone,''), _items,
    COALESCE(_subtotal, 0), COALESCE(NULLIF(_currency,''), 'SAR'),
    COALESCE(_reached_checkout, false), false,
    COALESCE(NULLIF(_stage,''), 'cart'), 'web', now(), now(), now()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id          = COALESCE(auth.uid(), ac.user_id),
    email            = COALESCE(NULLIF(_email,''), ac.email),
    phone            = COALESCE(NULLIF(_phone,''), ac.phone),
    items            = EXCLUDED.items,
    subtotal         = EXCLUDED.subtotal,
    currency         = EXCLUDED.currency,
    reached_checkout = ac.reached_checkout OR EXCLUDED.reached_checkout,
    stage            = CASE WHEN EXCLUDED.reached_checkout THEN EXCLUDED.stage ELSE ac.stage END,
    updated_at       = now()
  WHERE ac.converted = false;
END;
$$;

REVOKE ALL ON FUNCTION public.track_cart(text, jsonb, numeric, text, text, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_cart(text, jsonb, numeric, text, text, text, boolean, text) TO anon, authenticated, service_role;