import { describe, expect, it } from "vitest";
import { isIsoCurrency, shouldTransmitMeta, stableMetaEventId, toMetaEventName } from "./meta-events";

describe("Meta event contract", () => {
  it("maps internal names to exact standard names", () => {
    expect(toMetaEventName("page_view")).toBe("PageView");
    expect(toMetaEventName("add_to_cart")).toBe("AddToCart");
    expect(toMetaEventName("Purchase")).toBe("Purchase");
  });

  it("creates stable logical IDs", () => {
    expect(stableMetaEventId("Purchase", "MN-123")).toBe(stableMetaEventId("Purchase", "MN-123"));
    expect(stableMetaEventId("Purchase", "MN-123")).not.toBe(stableMetaEventId("Purchase", "MN-124"));
  });

  it("accepts ISO currency codes only", () => {
    expect(isIsoCurrency("SAR")).toBe(true);
    expect(isIsoCurrency("sar")).toBe(false);
  });

  it("blocks transmission until marketing consent is explicit", () => {
    expect(shouldTransmitMeta(false)).toBe(false);
    expect(shouldTransmitMeta(true)).toBe(true);
  });
});
