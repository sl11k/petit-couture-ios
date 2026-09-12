import { afterEach, describe, expect, it, vi } from "vitest";
import { hashedUserData, normalizeMetaEmail, normalizeMetaPhone, sendMetaCapiEvents, sha256 } from "./meta-capi.server";

afterEach(() => vi.unstubAllGlobals());

describe("Meta CAPI user matching", () => {
  it("normalizes email and GCC phones", () => {
    expect(normalizeMetaEmail(" Test@Example.COM ")).toBe("test@example.com");
    expect(normalizeMetaPhone("055 016 7199", "SA")).toBe("966550167199");
    expect(normalizeMetaPhone("+971 50 123 4567", "AE")).toBe("971501234567");
    expect(normalizeMetaPhone("123", "SA")).toBe("");
  });

  it("hashes normalized values and does not double hash", async () => {
    const emailHash = await sha256("test@example.com");
    const first = await hashedUserData({ email: " Test@Example.COM ", phone: "0550167199", country: "SA" });
    const second = await hashedUserData({ email: emailHash });
    expect(first.em).toEqual([emailHash]);
    expect(first.ph).toEqual([await sha256("966550167199")]);
    expect(second.em).toEqual([emailHash]);
  });

  it("keeps guest-safe browser and request signals", async () => {
    const data = await hashedUserData({ fbp: "fb.1.1.1", fbc: "fb.1.1.click", client_ip_address: "203.0.113.1", client_user_agent: "browser" });
    expect(data).toMatchObject({ fbp: "fb.1.1.1", fbc: "fb.1.1.click", client_ip_address: "203.0.113.1", client_user_agent: "browser" });
    expect(data).not.toHaveProperty("em");
  });

  it("retries a transient rejection without changing event identity", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 2, message: "temporary" } }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ events_received: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendMetaCapiEvents("pixel", "secret", [{ event_name: "PageView", event_id: "same-id" }], {});
    expect(result).toMatchObject({ ok: true, events_received: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const second = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(first.data[0].event_id).toBe("same-id");
    expect(second.data[0].event_id).toBe("same-id");
  });

  it("does not retry permanent recipient or payload errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 100, message: "invalid" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendMetaCapiEvents("pixel", "secret", [{ event_name: "Purchase", event_id: "purchase-1" }], {});
    expect(result).toMatchObject({ ok: false, http_status: 400, error_code: "100" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});