import { afterEach, describe, expect, it, vi } from "vitest";
import { wasenderProvider } from "./wasender";

describe("Wasender acceptance", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("rejects HTTP success without a provider message ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
    const result = await wasenderProvider.send({ api_key: "not-real" }, { to: "+966550167199", body: "test" });
    expect(result.ok).toBe(false); expect(result.error_code).toBe("provider_message_id_missing");
  });
  it("rejects a disconnected session even when Wasender returns HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: false,
      message: "Your Whatsapp Session is not connected please connect your session first.",
    }), { status: 200 })));
    const result = await wasenderProvider.send({ api_key: "not-real" }, { to: "+966550167199", body: "test" });
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe("provider_session_disconnected");
    expect(result.retryable).toBe(false);
    expect(result.provider_message_id).toBeUndefined();
  });
  it("reports a disconnected session as unhealthy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: false,
      status: "disconnected",
      message: "Session disconnected",
    }), { status: 200 })));
    const result = await wasenderProvider.checkHealth?.({ api_key: "not-real" });
    expect(result?.ok).toBe(false);
    expect(result?.session_status).toBe("disconnected");
  });
  it("marks provider timeouts retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("timeout"))));
    const result = await wasenderProvider.send({ api_key: "not-real" }, { to: "+966550167199", body: "test" });
    expect(result.ok).toBe(false); expect(result.retryable).toBe(true);
  });
});