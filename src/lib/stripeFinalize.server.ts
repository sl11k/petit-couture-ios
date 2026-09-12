import { z } from "zod";

export const stripeFinalizeInputSchema = z.object({
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
  ].map((value) => String(value || "").trim());
  return candidates.find((value) => value.startsWith("sk_")) || null;
}

export async function finalizeStripeOrderOnServer(data: z.infer<typeof stripeFinalizeInputSchema>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const secret = await getStripeSecret();
  if (!secret) return { ok: false as const, reason: "no_secret" };

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, currency, payment_method, payment_status, user_id")
    .eq("order_number", data.order_number)
    .maybeSingle();
  if (orderErr || !order) return { ok: false as const, reason: "no_order" };
  if (order.payment_status === "paid") {
    try {
      const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
      const result = await createOtoShipmentForOrder(order.id, order.user_id ?? null);
      if (!result.ok) console.error("[finalizeStripeOrder] OTO retry failed:", result.error);
    } catch (error) {
      console.error("[finalizeStripeOrder] OTO retry threw:", error);
    }
    return { ok: true as const, already: true };
  }

  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.stripe_session_id)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const session = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false as const, reason: "stripe_error", detail: session?.error?.message };

  const paymentStatus = String(session?.payment_status || "");
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    return { ok: false as const, reason: "not_paid_yet", stripe_status: paymentStatus };
  }

  const amount = Number(session?.amount_total ?? 0) / 100;
  const currency = String(session?.currency || order.currency).toUpperCase();
  if (Math.abs(Number(order.total) - amount) > 0.01) {
    return { ok: false as const, reason: "amount_mismatch" };
  }
  if (String(order.currency).toUpperCase() !== currency) {
    return { ok: false as const, reason: "currency_mismatch" };
  }

  const sessionId = String(session.id);
  const { data: existing } = await supabaseAdmin
    .from("payment_transactions")
    .select("id")
    .eq("gateway", "stripe")
    .eq("gateway_transaction_id", sessionId)
    .maybeSingle();

  let transactionId = existing?.id as string | undefined;
  const pendingUpdate = {
    status: "processing",
    webhook_verified: true,
    raw_response: session as never,
    updated_at: new Date().toISOString(),
  };
  if (transactionId) {
    const { error } = await supabaseAdmin
      .from("payment_transactions")
      .update(pendingUpdate)
      .eq("id", transactionId);
    if (error) return { ok: false as const, reason: "tx_update", detail: error.message };
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        order_id: order.id,
        order_number: order.order_number,
        amount,
        currency,
        gateway: "stripe",
        gateway_transaction_id: sessionId,
        idempotency_key: `stripe:finalize:${sessionId}`,
        ...pendingUpdate,
      } as never)
      .select("id")
      .single();
    if (error || !inserted) return { ok: false as const, reason: "tx_insert", detail: error?.message };
    transactionId = inserted.id;
  }

  const { error: rpcError } = await supabaseAdmin.rpc("complete_async_payment", {
    _order_id: order.id,
    _gateway: order.payment_method,
    _gateway_transaction_id: sessionId,
    _transaction_id: transactionId,
    _amount: amount,
    _currency: currency,
  });
  if (rpcError) return { ok: false as const, reason: "rpc_failed", detail: rpcError.message };

  try {
    const { emitMetaPurchaseForPaidOrder } = await import("@/lib/meta-purchase.server");
    await emitMetaPurchaseForPaidOrder(order.id);
  } catch {
    console.warn("[finalizeStripeOrder] Meta Purchase scheduling failed");
  }

  try {
    const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
    const result = await createOtoShipmentForOrder(order.id, order.user_id ?? null);
    if (!result.ok) console.error("[finalizeStripeOrder] OTO create failed:", result.error);
  } catch (error) {
    console.error("[finalizeStripeOrder] OTO create threw:", error);
  }

  return { ok: true as const, already: false };
}