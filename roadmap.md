# WhatsApp order notifications

- [x] Trace current paid-order customer/admin notification flow and provider configuration
- [x] Add official server-side WhatsApp provider and secure verified status webhook
- [x] Enforce E.164 validation, idempotency, lifecycle ordering, retries, and terminal failure
- [x] Update admin statuses, filters, diagnostics, and manual-link labeling
- [x] Add safe historical reclassification migration
- [x] Add automated tests and run typecheck/build
- [x] Document missing owner configuration without sending live messages

## Meta Pixel + Conversions API
- [x] Audit browser Pixel, server CAPI, consent, and verified Purchase paths
- [x] Implement shared event identity, consent gating, enrichment, and idempotency
- [x] Harden commerce payload validation, timeouts, and sanitized diagnostics
- [ ] Add automated tests and run typecheck/build without sending live events
- [ ] Document event mapping and any remaining owner configuration
