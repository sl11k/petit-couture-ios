import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone } from "./phone";

describe("normalizeWhatsAppPhone", () => {
  it("normalizes Saudi local and international numbers", () => {
    expect(normalizeWhatsAppPhone("055 016 7199")).toEqual({ ok: true, e164: "+966550167199", digits: "966550167199" });
    expect(normalizeWhatsAppPhone("00971586116003")).toEqual({ ok: true, e164: "+971586116003", digits: "971586116003" });
  });
  it("rejects invalid recipients", () => expect(normalizeWhatsAppPhone("123").ok).toBe(false));
});
