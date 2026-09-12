# Meta Pixel + Conversions API hardening

## Goal
Make browser Pixel and server Conversions API events consent-aware, consistently named, enriched, deduplicated, and safe without publishing or sending test events.

## Current root causes
- Marketing scripts, `_fbp`/`_fbc`, visitor identifiers, and CAPI calls currently run without checking the existing marketing-cookie consent.
- `PageView` is browser-only and has no shared `event_id`; initial page loading can also create duplicate page views.
- Event IDs use the current time and randomness at dispatch, so retries, remounts, and Purchase page reloads can create new IDs for the same logical event.
- Purchase is emitted from the confirmation screen without a durable server idempotency record; the ready state is not itself a strict paid-only condition.
- Phone normalization strips characters but does not reliably produce digits-only E.164 before hashing.
- CAPI has no request timeout and exposes more provider error text than needed for safe diagnostics.
- Multiple browser Meta rows can diverge from the single Pixel ID selected for CAPI.

## Implementation
1. **Create one shared Meta event contract**
   - Map internal names to the exact standard names: `PageView`, `ViewContent`, `Search`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, and `Purchase`.
   - Validate ISO currency, finite non-negative values, item IDs, quantities, contents, content type, and Purchase order ID.
   - Generate or derive the event ID once in the browser and pass the same name/ID to both `fbq` and CAPI.

2. **Enforce marketing consent before any Meta activity**
   - Do not load Meta scripts, capture `fbclid`, create Meta cookies/visitor identifiers, store Pixel user identity, or call CAPI until `marketing: true` is recorded.
   - React immediately when cookie choices change, loading queued marketing events only after consent.
   - Necessary storefront behavior and non-marketing analytics remain unaffected.

3. **Strengthen event identity and duplicate protection**
   - Use stable navigation IDs for `PageView`, product IDs for one logical `ViewContent`, action IDs for cart/payment actions, and a deterministic order-based ID for `Purchase`.
   - Add session-backed suppression for route remounts and StrictMode, plus durable server idempotency for CAPI retries and verified purchases.
   - Prevent duplicate initial `PageView` and ensure retries reuse the original ID rather than generating another event.

4. **Improve server-side match quality safely**
   - Normalize email and digits-only international phone data before SHA-256 hashing on the server.
   - Detect valid pre-hashed values to avoid double hashing.
   - Include hashed `external_id`, request-derived IP/user agent, consented `_fbp`/`_fbc`, source URL, and `action_source: website` only when genuinely available.
   - Never persist or log raw contact values or credentials.

5. **Cover browser and server event paths**
   - Mirror `PageView` and `ViewContent` to CAPI with the same browser event ID.
   - Preserve all real storefront action call sites and align duplicate `AddPaymentInfo` payloads.
   - Emit Purchase only after verified `paid/captured/succeeded` state, with actual order total, currency, order ID, and line-item contents.
   - Use a server-side paid-order fallback with the same deterministic Purchase identity so payment callbacks and success-page reloads deduplicate.

6. **Harden delivery and diagnostics**
   - Keep the existing Pixel ID and secret token configuration unchanged and server-only.
   - Add a bounded request timeout and sanitized result/error diagnostics that never block browsing or checkout.
   - Avoid live Meta test-event calls during verification.

7. **Verify without publishing**
   - Add tests for normalization/hashing, exact browser+CAPI name and ID pairing, PageView/ViewContent guest enrichment, consent gating, StrictMode/remount suppression, retries, and Purchase idempotency.
   - Run focused tests, TypeScript checks, and the production build.
   - Report exact changed files/settings, event mapping, verification results, and any remaining Meta-side configuration.

## Technical details
- A small database ledger will reserve CAPI event IDs atomically and prevent repeated server submissions. It will store event identity/status and sanitized diagnostics only—never access tokens, raw email, raw phone, cookies, IP addresses, or payloads.
- Browser suppression will use consent-aware session storage. Purchase IDs will derive from the immutable order identifier so browser and payment-confirmation paths converge.
- The Meta access token remains in the existing server secret; the existing configured Pixel ID remains unchanged.
- No publish, deployment, or Meta test/live event transmission will occur during implementation or verification.