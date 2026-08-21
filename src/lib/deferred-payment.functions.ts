import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reconcileDeferredPayments } from "@/lib/deferred-payment-reconciliation.server";

export const reconcileReturnedPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ order_number: z.string().min(3).max(64) }).parse(input))
  .handler(async ({ data }) => reconcileDeferredPayments({ orderNumber: data.order_number }));