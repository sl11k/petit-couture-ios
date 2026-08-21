import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  completeGatewayPayment,
  failGatewayPayment,
  loadGatewayOrder,
  money,
} from "@/lib/payment-gateway.server";
import { convertPegged } from "@/lib/tabby-currency";

type PendingTransaction = {
  order_number: string | null;
  gateway: string;
  gateway_reference: string | null;
  gateway_transaction_id: string | null;
};

async function getIntegrationToken(provider: "tabby" | "tamara") {
  const envToken = provider === "tabby" ? process.env.TABBY_SECRET_KEY : process.env.TAMARA_API_TOKEN;
  if (envToken) return envToken;
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("api_key, api_secret, config")
    .eq("category", "payment")
    .eq("provider", provider)
    .eq("enabled", true)
    .maybeSingle();
  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<string, unknown>;
  return [data?.api_secret, config.api_token, config.secret_key, data?.api_key]
    .map((value) => String(value || "").trim())
    .find(Boolean) ?? null;
}

async function reconcileTamara(tx: PendingTransaction) {
  const orderNumber = String(tx.order_number || "");
  const providerId = String(tx.gateway_transaction_id || "");
  if (!orderNumber || !providerId) return { order_number: orderNumber, skipped: "missing_provider_id" };
  const token = await getIntegrationToken("tamara");
  if (!token) throw new Error("TAMARA_API_TOKEN is not configured");
  const response = await fetch(`https://api.tamara.co/orders/${encodeURIComponent(providerId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const remote = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Tamara lookup failed (${response.status})`);
  const status = String(remote.status || "").toLowerCase();
  const order = await loadGatewayOrder({ orderNumber, gateway: "tamara" });
  if (["fully_captured", "partially_captured", "captured"].includes(status)) {
    await completeGatewayPayment({ order, gateway: "tamara", gatewayTransactionId: providerId, rawResponse: remote });
    return { order_number: orderNumber, status, finalized: true };
  }
  if (["declined", "canceled", "cancelled", "expired"].includes(status)) {
    await failGatewayPayment({ order, gateway: "tamara", gatewayTransactionId: providerId, reason: `tamara_${status}`, rawResponse: remote });
  }
  return { order_number: orderNumber, status, finalized: false };
}

async function reconcileTabby(tx: PendingTransaction) {
  const orderNumber = String(tx.order_number || "");
  const checkoutId = String(tx.gateway_reference || "");
  if (!orderNumber || !checkoutId) return { order_number: orderNumber, skipped: "missing_checkout_id" };
  const token = await getIntegrationToken("tabby");
  if (!token) throw new Error("TABBY_SECRET_KEY is not configured");
  const response = await fetch(`https://api.tabby.ai/api/v2/checkout/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const remote = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Tabby lookup failed (${response.status})`);
  const payment = (remote.payment && typeof remote.payment === "object" ? remote.payment : {}) as Record<string, unknown>;
  const status = String(payment.status || remote.status || "").toLowerCase();
  const paymentId = String(payment.id || "");
  const order = await loadGatewayOrder({ orderNumber, gateway: "tabby" });

  if (status === "authorized" && paymentId) {
    const settlementCurrency = String(payment.currency || order.currency).toUpperCase();
    const amount = convertPegged(money(order.total), String(order.currency).toUpperCase(), settlementCurrency);
    const captureResponse = await fetch(
      `https://api.tabby.ai/api/v1/payments/${encodeURIComponent(paymentId)}/captures`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amount.toFixed(2) }),
      },
    );
    const capture = await captureResponse.json().catch(() => ({}));
    if (!captureResponse.ok) throw new Error(`Tabby capture failed (${captureResponse.status})`);
    await completeGatewayPayment({ order, gateway: "tabby", gatewayTransactionId: paymentId, rawResponse: { checkout: remote, capture } });
    return { order_number: orderNumber, status: "closed", finalized: true };
  }
  if (status === "closed" && paymentId) {
    await completeGatewayPayment({ order, gateway: "tabby", gatewayTransactionId: paymentId, rawResponse: remote });
    return { order_number: orderNumber, status, finalized: true };
  }
  if (["rejected", "expired"].includes(status) && paymentId) {
    await failGatewayPayment({ order, gateway: "tabby", gatewayTransactionId: paymentId, reason: `tabby_${status}`, rawResponse: remote });
  }
  return { order_number: orderNumber, status, finalized: false };
}

export async function reconcileDeferredPayments(options: { orderNumber?: string; lookbackHours?: number } = {}) {
  const since = new Date(Date.now() - (options.lookbackHours ?? 24 * 30) * 3_600_000).toISOString();
  let query = supabaseAdmin
    .from("payment_transactions")
    .select("order_number, gateway, gateway_reference, gateway_transaction_id")
    .in("gateway", ["tabby", "tamara"])
    .in("status", ["pending", "processing", "initiated"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (options.orderNumber) query = query.eq("order_number", options.orderNumber);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const results: Array<Record<string, unknown>> = [];
  for (const tx of (data ?? []) as PendingTransaction[]) {
    try {
      results.push(tx.gateway === "tabby" ? await reconcileTabby(tx) : await reconcileTamara(tx));
    } catch (error) {
      results.push({ order_number: tx.order_number, gateway: tx.gateway, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: true as const, checked: data?.length ?? 0, results };
}