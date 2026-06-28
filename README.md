# Le Petit Paradis

## Visual storefront studio

Admins can press **Edit page** on the storefront homepage or open **Admin → Themes** (`/admin/themes`). Both entry points open the same full-screen visual studio with desktop, tablet, and mobile previews.

The studio includes 27 draggable blocks, global colors and spacing, responsive grids, real product feeds, media and editorial blocks, detailed button controls, duplication, visibility, ordering, and section-level layout controls. Clicking a preview section opens its controls immediately.

Choose **Save** to publish the current draft to the storefront. The configuration is cached locally and synchronized through `theme_customizations`, so visitors and other devices receive the published homepage. **Reset** publishes the starter layout.

Run `supabase/migrations/20260622000000_theme_customization.sql` for cloud persistence and `supabase/migrations/20260622130000_secure_theme_customizations.sql` to restrict publishing to storefront administrators. Browser storage under `lpp.visual-theme.v1` remains a fast local cache.

## OTO shipping integration

The OTO server integration is intentionally secret-only. Do not commit live credentials.

Required authentication, choose one:

```bash
OTO_API_TOKEN=...
# or
OTO_REFRESH_TOKEN=...
# or
OTO_CLIENT_ID=...
OTO_CLIENT_SECRET=...
```

Origin/sender, choose one mode:

```bash
# pickup-location mode
OTO_PICKUP_LOCATION_CODE=...
# or match by name if you do not know the code
OTO_PICKUP_LOCATION_NAME=...

# sender-information mode
OTO_SENDER_FULL_NAME=...
OTO_SENDER_MOBILE=...
OTO_SENDER_SHORT_ADDRESS_CODE=...
```

If any sender information is configured, the backend sends `senderInformation` and never mixes it with `pickupLocationCode`. Otherwise it uses the pickup location. Optional defaults:

```bash
OTO_DEFAULT_DELIVERY_OPTION_ID=...
OTO_ORIGIN_CITY=Riyadh
OTO_DEFAULT_BOX_WIDTH_CM=10
OTO_DEFAULT_BOX_LENGTH_CM=10
OTO_DEFAULT_BOX_HEIGHT_CM=10
```

After payment is confirmed by Stripe, Tabby, or Tamara, the backend creates the OTO order, fetches delivery options, selects the configured/default option, creates the shipment, saves tracking/AWB data into `shipments`, and updates the order shipping status.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```
