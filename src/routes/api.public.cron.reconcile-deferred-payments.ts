import { createFileRoute } from "@tanstack/react-router";
import { reconcileDeferredPayments } from "@/lib/deferred-payment-reconciliation.server";

async function run() {
  return reconcileDeferredPayments();
}

function isAllowed(request: Request) {
  const expected = String(process.env.PAYMENT_WEBHOOK_SECRET || "").trim();
  if (!expected) return true;
  const provided = request.headers.get("x-cron-key") || "";
  return provided === expected;
}

export const Route = createFileRoute("/api/public/cron/reconcile-deferred-payments")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        isAllowed(request) ? Response.json(await run()) : new Response("Unauthorized", { status: 401 }),
      POST: async ({ request }) =>
        isAllowed(request) ? Response.json(await run()) : new Response("Unauthorized", { status: 401 }),
    },
  },
});