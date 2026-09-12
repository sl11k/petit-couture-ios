import { describe, expect, it } from "vitest";
import { canApplyProviderStatus, retryDelayMs, retryDisposition, sanitizeProviderError } from "./lifecycle";

describe("WhatsApp lifecycle", () => {
  it("prevents out-of-order downgrades", () => {
    expect(canApplyProviderStatus("read", "delivered")).toBe(false);
    expect(canApplyProviderStatus("sent", "delivered")).toBe(true);
  });
  it("classifies permanent rejection and transient timeout", () => {
    expect(retryDisposition(400, "131026", "invalid recipient").retry).toBe(false);
    expect(retryDisposition(429, "rate_limit", "too many").retry).toBe(true);
    expect(retryDisposition(undefined, "timeout", "network timeout").retry).toBe(true);
  });
  it("bounds exponential retry delays", () => expect(retryDelayMs(20)).toBe(60 * 60_000));
  it("redacts secrets and phone numbers", () => {
    const safe = sanitizeProviderError("Bearer abc.def token=secret +966550167199");
    expect(safe).not.toContain("abc.def"); expect(safe).not.toContain("550167199");
  });
});
