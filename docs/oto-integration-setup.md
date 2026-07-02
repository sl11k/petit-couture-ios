# OTO Integration Setup

This project already contains the OTO shipping flow. Orders are sent to OTO automatically after a payment is confirmed, then the shipment and tracking fields are written back to Supabase.

## What is already wired

- `src/lib/oto.server.ts`
  - Builds the OTO order payload.
  - Resolves delivery options.
  - Creates shipments.
  - Reads order status, AWB, and tracking URLs.
- `src/routes/api.public.payment-webhook.ts`
  - Triggers automatic OTO shipment creation after payment capture.
- `src/routes/api.public.stripe-webhook.ts`
  - Also triggers automatic OTO shipment creation after Stripe capture.
- `src/routes/api.public.oto.webhook.ts`
  - Receives OTO webhook updates.

## OTO account fields and what to enter

These are the fields shown by OTO support and how they map to this project:

- Store name
  - Use your shop name, for example `Petit Couture`.
  - In the app this is mainly reflected through `VITE_STORE_NAME` / sender display values.
- Refresh token
  - Put it in `OTO_REFRESH_TOKEN`.
  - If OTO gave you a client id and secret instead, use `OTO_CLIENT_ID` and `OTO_CLIENT_SECRET`.
- Order prefix
  - Use `OTO_ORDER_PREFIX` if your OTO tenant or workflow expects prefixed order numbers.
  - If you do not need it, leave it empty.
- Sales channel
  - If OTO asks you to enable sales channel integration, do that inside the OTO dashboard.
  - No separate SQL change is needed for this.
- Advanced settings
  - Set webhook secret, webhook authorization key, pickup location or sender details, and default delivery option as needed.

## Environment variables to configure

Set these in your deployment environment or secrets manager:

```bash
OTO_API_BASE_URL=https://api.tryoto.com/rest/v2
OTO_REFRESH_TOKEN=your_refresh_token_here
OTO_CLIENT_ID=your_client_id_here
OTO_CLIENT_SECRET=your_client_secret_here
OTO_API_TOKEN=

OTO_SENDER_NAME=Petit Couture
OTO_SENDER_ADDRESS_NAME=Petit Couture
OTO_SENDER_FULL_NAME=Petit Couture
OTO_SENDER_MOBILE=05xxxxxxxx
OTO_SENDER_EMAIL=store@example.com
OTO_SENDER_COUNTRY=SA
OTO_SENDER_CITY=Riyadh
OTO_SENDER_DISTRICT=
OTO_SENDER_POSTCODE=
OTO_SENDER_ADDRESS_LINE=
OTO_SENDER_SHORT_ADDRESS_CODE=
OTO_SENDER_LAT=
OTO_SENDER_LON=

OTO_PICKUP_LOCATION_CODE=
OTO_PICKUP_LOCATION_NAME=
OTO_DEFAULT_DELIVERY_OPTION_ID=
OTO_ALLOW_UNSIGNED=1
OTO_WEBHOOK_SECRET_KEY=generate-a-random-secret
OTO_WEBHOOK_AUTHORIZATION_KEY=Bearer-your-webhook-auth-key
```

Notes:

- Use either `OTO_REFRESH_TOKEN` or `OTO_CLIENT_ID` + `OTO_CLIENT_SECRET`.
- If you have a real sender short address code, put it in `OTO_SENDER_SHORT_ADDRESS_CODE`.
- If you want OTO to use a pickup location instead, set `OTO_PICKUP_LOCATION_CODE` or `OTO_PICKUP_LOCATION_NAME`.
- `OTO_ALLOW_UNSIGNED=1` is only for temporary setup while you confirm OTO's webhook signature behavior.

## SQL for Supabase

Run this in the Supabase SQL editor if you want a single idempotent block that makes the OTO setup explicit.

```sql
-- OTO carrier entry
INSERT INTO public.shipping_carriers (
  code,
  name_ar,
  name_en,
  carrier_type,
  is_active,
  supports_cod,
  supports_international,
  supports_tracking,
  supports_webhook,
  default_delivery_days_min,
  default_delivery_days_max,
  display_order
)
VALUES (
  'oto',
  'OTO',
  'OTO',
  'aggregator',
  true,
  true,
  false,
  true,
  true,
  1,
  3,
  0
)
ON CONFLICT (code) DO UPDATE
SET
  is_active = true,
  supports_webhook = true,
  name_en = 'OTO';

-- Integration row used by the admin page
INSERT INTO public.integrations (
  category,
  provider,
  display_name,
  enabled,
  mode,
  config
)
VALUES (
  'shipping',
  'oto',
  'OTO',
  true,
  'production',
  '{}'::jsonb
)
ON CONFLICT (category, provider) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  enabled = EXCLUDED.enabled,
  mode = EXCLUDED.mode,
  updated_at = now();

-- Order columns used for idempotent shipment creation
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS oto_creation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS oto_creation_error text;

-- Claim function used by the webhook handlers before calling OTO
CREATE OR REPLACE FUNCTION public.claim_oto_shipment_creation(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claim_oto$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.oto_creation_started_at IS NOT NULL
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

REVOKE ALL ON FUNCTION public.claim_oto_shipment_creation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_oto_shipment_creation(uuid) TO service_role;
```

## How the automatic flow works

1. Customer pays.
2. Payment webhook marks the order as paid.
3. The app loads order items and shipping address from Supabase.
4. The app sends the order to OTO.
5. The app selects a delivery option and creates the shipment.
6. Tracking number, tracking URL, and AWB URL are saved back to the order and shipment tables.

## Important rules from OTO

- Send either `pickupLocationCode` or `senderInformation`, not both.
- If `senderShortAddressCode` exists, do not force address fields.
- `packageWeight`, `amount`, `currency`, and `item_description` must be present.
- Use the OTO webhook endpoint in the app:
  - `/api/public/oto/webhook`

## What you still need to do manually

- Put the environment variables into your deployment host.
- Register the webhook URL in OTO.
- Test with one paid order in a safe sandbox or test store first.

