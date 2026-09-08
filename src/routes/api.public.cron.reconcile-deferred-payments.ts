import { createFileRoute } from "@tanstack/react-router";
import { reconcileDeferredPayments } from "@/lib/deferred-payment-reconciliation.server";

async function run() {
  return reconcileDeferredPayments();
}

export const Route = createFileRoute("/api/public/cron/reconcile-deferred-payments")({
  server: {
    handlers: {
      GET: async () => Response.json(await run()),
      POST: async () => Response.json(await run()),
    },
  },
});