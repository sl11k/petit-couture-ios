import { afterEach, describe, expect, it, vi } from "vitest";
import { wasenderProvider } from "./wasender";

describe("Wasender acceptance", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("rejects HTTP success without a provider message ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
    const result = await wasenderProvider.send({ api_key: "not-real" }, { to: "+966550167199", body: "test" });
    expect(result.ok).toBe(false); expect(result.error_code).toBe("provider_message_id_missing");
  });
  it("marks provider timeouts retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("timeout"))));
    const result = await wasenderProvider.send({ api_key: "not-real" }, { to: "+966550167199", body: "test" });
    expect(result.ok).toBe(false); expect(result.retryable).toBe(true);
  });
});