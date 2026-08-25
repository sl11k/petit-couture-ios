// Safety net: if a Stripe webhook is missed (or the customer never returns to
// the confirmation page), any paid checkout would stay stuck as unpaid and
// never reach the admin orders list or notifications. This cron polls Stripe
// for recent non-paid orders that have a Stripe session and finalizes them.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finalizeStripeOrder } from "@/lib/stripeFinalize.functions";

const LOOKBACK_HOURS = 72;

async function run() {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();

  const { data: txs, error } = await supabaseAdmin
    .from("payment_transactions")
    .select("gateway_transaction_id, order_number, created_at")
    .eq("gateway", "stripe")
    // "captured" is included on purpose: if the transaction was captured but the
    // order update failed (trigger error, transient issue), the order would stay
    // unpaid forever and never appear in the admin orders list.
    .in("status", ["pending", "processing", "initiated", "captured"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false as const, error: error.message };

  const results: Array<Record<string, unknown>> = [];
  for (const tx of txs ?? []) {
    const sessionId = String(tx.gateway_transaction_id || "");
    const orderNumber = String(tx.order_number || "");
    if (!sessionId.startsWith("cs_") || !orderNumber) continue;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("payment_status")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (!order || order.payment_status === "paid") continue;

    try {
      const res = await finalizeStripeOrder({
        data: { order_number: orderNumber, stripe_session_id: sessionId },
      });
      results.push({ order_number: orderNumber, ...res });
    } catch (err) {
      results.push({
        order_number: orderNumber,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ok: true as const, checked: txs?.length ?? 0, results };
}

export const Route = createFileRoute("/api/public/cron/reconcile-stripe")({
  server: {
    handlers: {
      GET: async () => Response.json(await run()),
      POST: async () => Response.json(await run()),
    },
  },
});
