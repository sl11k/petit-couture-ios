
## Why the current setup is wrong

- The current `/admin/incoming-webhooks` page treats OTO like a generic provider that just POSTs to us with `X-Webhook-Signature = HMAC_SHA256_hex(body, secret)`. OTO does not work that way.
- OTO requires us to **register our endpoint with them** via `POST https://api.tryoto.com/rest/v2/webhook` using a Bearer token, and OTO embeds a **`signature` field inside the JSON body**, computed as `Base64(HmacSHA256("orderId:status:timestamp" or "orderId:errorCode:timestamp", secretKey))`.
- The raw secret env name (`SHIPPING_WEBHOOK_SECRET`) is shown in the UI and even revealed as plain text (which is how the page ended up displaying garbage like "not now" / "بعدين" — those are literal stored secret values).
- Payment webhook is mixed into the same page with a fake Stripe sample even though no payment provider is integrated.

## What we'll build

### A. Backend

1. **New OTO inbound endpoint** — `src/routes/api.public.oto.webhook.ts` (`POST /api/public/oto/webhook`):
   - Detects `orderStatus` vs `shipmentError` from payload fields.
   - Optional `Authorization` header check against `OTO_WEBHOOK_AUTHORIZATION_KEY`.
   - Optional in-body `signature` check via new util `verifyOtoWebhookSignature`.
   - In production, missing signature when `OTO_WEBHOOK_SECRET_KEY` is configured → 401. Unsigned mode allowed only when `OTO_ALLOW_UNSIGNED=1`.
   - Normalizes payload, updates `shipments` and `orders.shipping_status` using the new OTO status map, inserts `shipment_tracking_events` and a row in the new `oto_webhook_deliveries` log.
   - Returns `{ ok, provider:"oto", eventType, orderId, trackingNumber }`.

2. **Old `/api/public/shipping-webhook`** kept as a thin compat shim that 410s with a pointer to the new URL (no behavior change to `payment-webhook`).

3. **OTO signature/status utilities** — `src/lib/oto-webhook.ts` (server-safe, pure):
   - `buildOtoSignatureBase(payload)` → string per event type.
   - `verifyOtoWebhookSignature(payload, secretKey)` → boolean (HMAC-SHA256, Base64, timing-safe).
   - `mapOtoStatus(otoStatus)` → internal status (`processing | in_transit | delivered | returned | failed | unknown`) preserving raw value.
   - `normalizeOtoPayload(payload)` → discriminated union `{ kind:"orderStatus"|"shipmentError", ...fields }`.

4. **Admin webhook registration server fn** — `src/lib/oto-webhook.functions.ts` + `.server.ts`:
   - `otoRegisterWebhook({ webhookType, endpointUrl, orderPrefix?, timestampFormat?, useSecret?, useAuth? })`.
   - Server-only. Reads `OTO_API_BASE_URL`, gets bearer via existing `getOtoAccessToken`, POSTs to `/webhook`.
   - Reads `OTO_WEBHOOK_SECRET_KEY` / `OTO_WEBHOOK_AUTHORIZATION_KEY` server-side; never sent to browser.
   - Persists result in new `oto_webhook_registrations` table (id, webhook_type, url, oto_webhook_id, status, response, created_by, created_at, last_registered_at).
   - `otoListWebhookRegistrations()` and `otoListOtoDeliveries()` for the UI.
   - `otoSendLocalTestWebhook(kind)` — POSTs a sample OTO-shaped body (with valid signature when secret configured) to our own `/api/public/oto/webhook` and returns the result.

### B. Database

Migration `oto_webhooks_setup`:
- `oto_webhook_registrations(id, webhook_type, endpoint_url, oto_webhook_id, status, response jsonb, created_by uuid, created_at, last_registered_at)` — RLS: admin/super_admin only via `has_role`.
- `oto_webhook_deliveries(id, webhook_type, order_id text, raw jsonb, signature_present bool, signature_valid bool, auth_valid bool, processed bool, processing_error text, http_status int, received_at)` — RLS: admin/super_admin read; service role inserts.

(Existing `shipping_webhooks_log` and `webhook_deliveries` tables are left untouched.)

### C. Admin UI

- Rename route file `src/routes/admin.incoming-webhooks.tsx` → completely rewritten as **OTO Webhook Setup** page (tab title: "تكاملات الشحن — OTO Webhooks").
- Sections:
  1. **Status card**: `OTO_API_TOKEN` configured/missing, `OTO_WEBHOOK_SECRET_KEY` configured/missing (mask shown as `••••last4`), `OTO_WEBHOOK_AUTHORIZATION_KEY` same.
  2. **Endpoint URL** (copy-only, no secret shown): `https://lppme.trendify.sa/api/public/oto/webhook`.
  3. **Register webhook**: dropdown for `webhookType` (orderStatus / shipmentError / newOrders), optional `orderPrefix`, `timestampFormat` (default `YYYY-MM-DD HH:mm:ss`), checkboxes "إرسال secretKey" / "إرسال authorizationKey" — calls `otoRegisterWebhook`.
  4. **Registrations table**: list from `oto_webhook_registrations`.
  5. **Send local test** button → calls `otoSendLocalTestWebhook`, links to deliveries.
  6. Help text in Arabic explaining: نحن نسجّل الويب هوك في OTO عبر API ولا ننتظر منهم رابطًا، التوقيع داخل الجسم وليس في `X-Webhook-Signature`، إلخ.
- **Payment webhooks**: separate page `src/routes/admin.payment-webhooks.tsx` clearly marked "Not configured — no payment provider integrated yet".
- Sidebar `nav.config.ts`: add "OTO Webhooks" entry under Shipping; remove/repoint old "Webhooks الواردة" if still there.

### D. Secrets handling

- Old `SHIPPING_WEBHOOK_SECRET` and `PAYMENT_WEBHOOK_SECRET` retained in env for backward compat but UI no longer renders them. Old `revealIncomingWebhookSecret` server fn deleted.
- New env names referenced in code: `OTO_API_TOKEN` (or fall back to existing `OTO_REFRESH_TOKEN` flow), `OTO_API_BASE_URL` (default `https://api.tryoto.com/rest/v2`), `OTO_WEBHOOK_SECRET_KEY`, `OTO_WEBHOOK_AUTHORIZATION_KEY`, `OTO_ALLOW_UNSIGNED`.
- `secrets.add_secret` will be requested for the three new ones at the end of implementation (user confirms in secure form). Founder must set them before live registration.

### E. Tests

`src/lib/oto-webhook.test.ts` (vitest, already in project):
- `verifyOtoWebhookSignature` ✓ valid orderStatus, ✓ valid shipmentError, ✗ tampered, ✗ wrong secret.
- `normalizeOtoPayload` ✓ both kinds.
- `mapOtoStatus` covers all required mappings.
- `buildRegistrationBody` (pure builder used by `otoRegisterWebhook`) returns expected shape.
- Endpoint contract test: unsigned payload rejected when secret configured + `OTO_ALLOW_UNSIGNED` unset.

### F. Docs

Create `.ai-os/` directory with:
- `ARABIC_CHANGELOG.md` — what/where/why/correct URL/required secrets/founder actions.
- `EVIDENCE.md`, `WORK_LOG.md`, `FINAL_REPORT.md`, `FOUNDER_REPORT.md`, `SESSION_MEMORY.md`, `CRITICAL_RISKS.md` — concise, scoped to this change.

### Files added / changed

```text
NEW   src/lib/oto-webhook.ts                  (signature + status + normalize utils)
NEW   src/lib/oto-webhook.server.ts           (registration + delivery queries, server-only)
NEW   src/lib/oto-webhook.functions.ts        (createServerFn wrappers)
NEW   src/lib/oto-webhook.test.ts             (vitest)
NEW   src/routes/api.public.oto.webhook.ts    (OTO inbound endpoint)
NEW   src/routes/admin.payment-webhooks.tsx   (clearly "Not configured")
EDIT  src/routes/admin.incoming-webhooks.tsx  (rewritten as OTO Webhook Setup)
EDIT  src/routes/api.public.shipping-webhook.ts (compat shim → 410 + pointer)
EDIT  src/features/admin/sidebar/nav.config.ts (label/section update)
DEL   src/lib/incoming-webhooks.functions.ts  (replaced)
DEL   src/lib/incoming-webhooks.server.ts     (replaced)
NEW   .ai-os/*.md                             (6 docs)
MIG   oto_webhooks_setup                      (2 tables + RLS)
SECRETS  OTO_WEBHOOK_SECRET_KEY, OTO_WEBHOOK_AUTHORIZATION_KEY, OTO_API_BASE_URL (optional)
```

### Verification

- Run `bunx vitest run src/lib/oto-webhook.test.ts`.
- `code--exec curl` against the new endpoint with a signed sample payload.
- Confirm typecheck via the harness build.

### Out of scope (will not do)

- Touching historical migrations.
- Auto-deploying or pushing.
- Setting secret values on user's behalf (only requesting via `add_secret`).
- Implementing real payment provider verification (no provider connected).

### Open vendor question

OTO's public docs do not always pin down the exact base-string ordering for signatures. Implementation will use the documented `orderId:status:timestamp` and `orderId:errorCode:timestamp` Base64-HMAC-SHA256 scheme exactly as you described, with a clearly marked TODO + admin-page note asking the founder to confirm with OTO support before relying on signatures in production. `OTO_ALLOW_UNSIGNED=1` is the documented escape hatch for the staging/confirmation period.

---

Approve this plan to proceed, or tell me what to adjust (e.g., skip the new tables and reuse `webhook_deliveries`, skip payment page, etc.).
