import { describe, expect, it } from "vitest";
import { amountsMatch, assertOrderTotals, money } from "./payment-validation";

describe("payment validation", () => {
  it("rounds monetary values to minor units", () => {
    expect(money("10.005")).toBe(10.01);
    expect(() => money("not-a-number")).toThrow("Invalid monetary value");
  });

  it("accepts only a one-halalah rounding difference", () => {
    expect(amountsMatch(100, 100.01)).toBe(true);
    expect(amountsMatch(100, 100.02)).toBe(false);
  });

  it("accepts consistent server-stored order totals", () => {
    expect(() =>
      assertOrderTotals(
        [
          { unit_price: 25, qty: 2 },
          { unit_price: 50, qty: 1 },
        ],
        { subtotal: 100, shipping_fee: 15, tax: 17.25, discount_amount: 10, total: 122.25 },
      ),
    ).not.toThrow();
  });

  it("rejects tampered item or order totals", () => {
    expect(() =>
      assertOrderTotals([{ unit_price: 25, qty: 2 }], {
        subtotal: 40,
        shipping_fee: 0,
        tax: 0,
        discount_amount: 0,
        total: 40,
      }),
    ).toThrow("Order totals are inconsistent");
  });
});
