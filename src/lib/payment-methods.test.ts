import { describe, expect, it } from "vitest";
import { paymentMethodSchema } from "@/lib/placeOrder.functions";
import { canCreateOtoShipmentForOrder } from "@/lib/oto.server";

describe("payment method handling", () => {
  it("accepts bank transfer as a valid payment method", () => {
    expect(paymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer");
  });

  it("allows OTO shipment creation for bank transfer orders", () => {
    expect(
      canCreateOtoShipmentForOrder({ payment_status: "pending", payment_method: "bank_transfer" }),
    ).toBe(true);
  });
});
