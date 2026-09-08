// Finalizes a Stripe checkout by fetching the session from Stripe and
// running the same complete_async_payment RPC the webhook runs. This is a
// safety net so a paid order still shows as paid on the confirmation page
// (and in admin) even if the Stripe webhook is delayed or misconfigured.
import { createServerFn } from "@tanstack/react-start";
import { finalizeStripeOrderOnServer, stripeFinalizeInputSchema } from "@/lib/stripeFinalize.server";

export const finalizeStripeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => stripeFinalizeInputSchema.parse(input))
  .handler(async ({ data }) => finalizeStripeOrderOnServer(data));
