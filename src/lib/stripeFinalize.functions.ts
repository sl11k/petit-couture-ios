// Finalizes a Stripe checkout by fetching the session from Stripe and
// running the same complete_async_payment RPC the webhook runs. This is a
// safety net so a paid order still shows as paid on the confirmation page
// (and in admin) even if the Stripe webhook is delayed or misconfigured.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  order_number: z.string().min(3).max(64),
  stripe_session_id: z.string().min(8).max(256),
});

async function getStripeSecret() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("api_key, api_secret, config")
    .eq("category", "payment")
    .eq("provider", "stripe")
    .eq("enabled", true)
    .maybeSingle();
  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<string, unknown>;
  const candidates = [
    data?.api_secret,
    config.secret_key,
    config.stripe_secret_key,
    data?.api_key,
    process.env.STRIPE_SECRET_KEY,
  ].map((v) => String(v || "").trim());
  return candidates.find((v) => v.startsWith("sk_")) || null;
}

export const finalizeStripeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = await getStripeSecret();
    if (!secret) return { ok: false as const, reason: "no_secret" };

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, currency, payment_method, payment_status, user_id")
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (orderErr || !order) return { ok: false as const, reason: "no_order" };
    if (order.payment_status === "paid") return { ok: true as const, already: true };

    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.stripe_session_id)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const session = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false as const, reason: "stripe_error", detail: session?.error?.message };

    const paymentStatus = String(session?.payment_status || "");
    if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
      return { ok: false as const, reason: "not_paid_yet", stripe_status: paymentStatus };
    }

    const amount = Number(session?.amount_total ?? 0) / 100;
    const currency = String(session?.currency || order.currency).toUpperCase();
    if (Math.abs(Number(order.total) - amount) > 0.01) {
      return { ok: false as const, reason: "amount_mismatch" };
    }

    // Upsert a captured transaction record for this Stripe session.
    const sessionId = String(session.id);
    const { data: existing } = await supabaseAdmin
      .from("payment_transactions")
      .select("id")
      .eq("gateway", "stripe")
      .eq("gateway_transaction_id", sessionId)
      .maybeSingle();

    let transactionId = existing?.id as string | undefined;
    const nowIso = new Date().toISOString();
    if (transactionId) {
      await supabaseAdmin
        .from("payment_transactions")
        .update({
          status: "captured",
          captured_at: nowIso,
          webhook_verified: true,
          raw_response: session as never,
        })
        .eq("id", transactionId);
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          order_id: order.id,
          order_number: order.order_number,
          amount,
          currency,
          gateway: "stripe",
          gateway_transaction_id: sessionId,
          idempotency_key: `stripe:finalize:${sessionId}`,
          status: "captured",
          captured_at: nowIso,
          webhook_verified: true,
          raw_response: session as never,
        } as never)
        .select("id")
        .single();
      if (insErr || !inserted) return { ok: false as const, reason: "tx_insert", detail: insErr?.message };
      transactionId = inserted.id;
    }

    const { error: rpcErr } = await (supabaseAdmin as any).rpc("complete_async_payment", {
      _order_id: order.id,
      _gateway: order.payment_method,
      _gateway_transaction_id: sessionId,
      _transaction_id: transactionId,
      _amount: amount,
      _currency: currency,
    });
    if (rpcErr) return { ok: false as const, reason: "rpc_failed", detail: rpcErr.message };

    await supabaseAdmin
      .from("orders")
      .update({
        payment_gateway: "stripe",
        last_transaction_id: transactionId,
        captured_amount: amount,
      })
      .eq("id", order.id);

    // Best-effort OTO creation.
    try {
      const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
      await createOtoShipmentForOrder(order.id, order.user_id ?? null);
    } catch (err) {
      console.error("[finalizeStripeOrder] OTO create threw:", err);
    }

    // Enqueue order.paid notification (best-effort).
    try {
      const { enqueueNotification } = await import("@/lib/notif/engine.server");
      const { data: full } = await supabaseAdmin
        .from("orders")
        .select("customer_name, customer_phone, customer_email, user_id, total, currency")
        .eq("id", order.id)
        .maybeSingle();
      if (full?.customer_phone) {
        await enqueueNotification({
          event_code: "order.paid",
          audience: "both",
          recipient_phone: full.customer_phone,
          recipient_email: full.customer_email,
          recipient_user_id: full.user_id,
          variables: {
            order_number: order.order_number,
            order_total: full.total,
            currency: full.currency,
            customer_name: full.customer_name,
            payment_method: "stripe",
            amount,
          },
          related_entity: "order",
          related_entity_id: order.id,
          dedupe_key: `order.paid:${order.id}`,
        });
      }
    } catch (err) {
      console.warn("[finalizeStripeOrder] notif enqueue failed:", err);
    }

    return { ok: true as const, already: false };
  });
