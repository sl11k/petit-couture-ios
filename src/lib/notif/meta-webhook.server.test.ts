import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractMetaStatuses, verifyMetaSignature } from "./meta-webhook.server";

describe("Meta WhatsApp webhook", () => {
  it("verifies signatures", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const sig = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, sig, "secret")).toBe(true);
    expect(verifyMetaSignature(body, sig, "wrong")).toBe(false);
  });
  it("creates stable idempotency keys for duplicate callbacks", () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "delivered", timestamp: "1789210000" }] } }] }] };
    expect(extractMetaStatuses(payload)[0].eventKey).toBe(extractMetaStatuses(payload)[0].eventKey);
  });
});
