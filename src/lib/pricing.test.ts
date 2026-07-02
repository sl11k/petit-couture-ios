import { describe, expect, it } from "vitest";
import { getCanonicalProductPrice } from "./pricing";

describe("getCanonicalProductPrice", () => {
  it("keeps the base product price even when a size variant has a different price", () => {
    expect(getCanonicalProductPrice(300, 100)).toBe(300);
  });

  it("falls back to the variant price only when no base price exists", () => {
    expect(getCanonicalProductPrice(null, 100)).toBe(100);
  });
});
