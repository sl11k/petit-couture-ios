import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { amountsMatch, money } from "@/lib/payment-validation";
import type { Json } from "@/integrations/supabase/types";

export { amountsMatch, money } from "@/lib/payment-validation";

export type AsyncPaymentGateway = "tabby" | "tamara";

type PaymentOrder = {
  id: string;
  order_number: string;
  payment_method: string;
  payment_status: string;
  idempotency_key: string | null;
  total: number;
  currency: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  shipping_fee: number;
  tax: number;
  discount_amount: number;
  coupon_code: string | null;
  shipping_address: Json;
  created_at: string;
};

function asJson(value: unknown): Json {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function loadCheckoutOrder(
  orderId: string,
  sessionId: string,
  gateway: AsyncPaymentGateway,
): Promise<PaymentOrder & Record<string, unknown>> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error("Order not found");
  if (order.payment_method !== gateway) throw new Error("Payment method mismatch");
  if (order.payment_status === "paid") throw new Error("Order is already paid");
  if (["cancelled", "refunded"].includes(String(order.status))) {
    throw new Error("Order can no longer be paid");
  }

  // Guest checkout ownership is bound to the high-entropy browser session that
  // created the order. Never allow a caller with only an order UUID to create
  // or replace its hosted payment session.
  if (!order.idempotency_key?.startsWith(`${sessionId}:`)) {
    throw new Error("Order session mismatch");
  }

  return order as PaymentOrder & Record<string, unknown>;
}

export async function recordPaymentSession(input: {
  order: PaymentOrder;
  gateway: AsyncPaymentGateway;
  gatewayReference?: string | null;
  gatewayTransactionId?: string | null;
  rawResponse?: unknown;
}) {
  const idempotencyKey = `${input.gateway}:checkout:${input.order.id}`;
  const row = {
    order_id: input.order.id,
    order_number: input.order.order_number,
    customer_email: input.order.customer_email,
    customer_name: input.order.customer_name,
    amount: money(input.order.total),
    currency: input.order.currency.toUpperCase(),
    gateway: input.gateway,
    gateway_reference: input.gatewayReference ?? null,
    gateway_transaction_id: input.gatewayTransactionId ?? null,
    status: "pending",
    idempotency_key: idempotencyKey,
    raw_response: asJson(input.rawResponse),
  };

  const { data: existing } = await supabaseAdmin
    .from("payment_transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("payment_transactions")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update payment transaction: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin
    .from("payment_transactions")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create payment transaction: ${error?.message}`);
  return data.id;
}

async function findOrCreateEventTransaction(input: {
  order: PaymentOrder;
  gateway: AsyncPaymentGateway;
  gatewayTransactionId: string;
  status: string;
  rawResponse: unknown;
}) {
  const { data: byGatewayId } = await supabaseAdmin
    .from("payment_transactions")
    .select("id, order_id")
    .eq("gateway", input.gateway)
    .eq("gateway_transaction_id", input.gatewayTransactionId)
    .maybeSingle();
  if (byGatewayId) {
    if (byGatewayId.order_id !== input.order.id) {
      throw new Error("Gateway transaction is already linked to another order");
    }
    return byGatewayId.id;
  }

  const idempotencyKey = `${input.gateway}:payment:${input.gatewayTransactionId}`;
  const { data, error } = await supabaseAdmin
    .from("payment_transactions")
    .upsert(
      {
        order_id: input.order.id,
        order_number: input.order.order_number,
        customer_email: input.order.customer_email,
        customer_name: input.order.customer_name,
        amount: money(input.order.total),
        currency: input.order.currency.toUpperCase(),
        gateway: input.gateway,
        gateway_transaction_id: input.gatewayTransactionId,
        status: input.status,
        idempotency_key: idempotencyKey,
        raw_response: asJson(input.rawResponse),
        webhook_verified: true,
      },
      { onConflict: "idempotency_key" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to record gateway event: ${error?.message}`);
  return data.id;
}

export async function loadGatewayOrder(input: {
  orderNumber: string;
  gateway: AsyncPaymentGateway;
  amount?: unknown;
  currency?: unknown;
}) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, payment_method, payment_status, idempotency_key, total, currency, customer_email, customer_name",
    )
    .eq("order_number", input.orderNumber)
    .single();
  if (error || !order) throw new Error("Order not found");
  if (order.payment_method !== input.gateway) throw new Error("Payment method mismatch");
  if (input.amount !== undefined && !amountsMatch(order.total, input.amount)) {
    throw new Error("Payment amount mismatch");
  }
  if (
    input.currency !== undefined &&
    String(order.currency).toUpperCase() !== String(input.currency).toUpperCase()
  ) {
    throw new Error("Payment currency mismatch");
  }
  return order as PaymentOrder;
}

export async function completeGatewayPayment(input: {
  order: PaymentOrder;
  gateway: AsyncPaymentGateway;
  gatewayTransactionId: string;
  rawResponse: unknown;
}) {
  const transactionId = await findOrCreateEventTransaction({
    ...input,
    status: "captured",
  });

  const { data, error } = await (
    supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("complete_async_payment", {
    _order_id: input.order.id,
    _gateway: input.gateway,
    _gateway_transaction_id: input.gatewayTransactionId,
    _transaction_id: transactionId,
    _amount: money(input.order.total),
    _currency: input.order.currency.toUpperCase(),
  });
  if (error) throw new Error(`Could not finalize paid order: ${error.message}`);

  const { error: transactionError } = await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "captured",
      captured_at: new Date().toISOString(),
      webhook_verified: true,
      raw_response: asJson(input.rawResponse),
    })
    .eq("id", transactionId);
  if (transactionError) {
    throw new Error(`Could not update captured transaction: ${transactionError.message}`);
  }

  return { transactionId, newlyFinalized: data === true };
}

export async function failGatewayPayment(input: {
  order: PaymentOrder;
  gateway: AsyncPaymentGateway;
  gatewayTransactionId: string;
  reason: string;
  rawResponse: unknown;
}) {
  const transactionId = await findOrCreateEventTransaction({
    ...input,
    status: "failed",
  });
  const { error } = await (
    supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("fail_async_payment", {
    _order_id: input.order.id,
    _gateway: input.gateway,
    _transaction_id: transactionId,
    _reason: input.reason.slice(0, 500),
  });
  if (error) throw new Error(`Could not fail payment safely: ${error.message}`);

  const { error: transactionError } = await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: input.reason.slice(0, 500),
      webhook_verified: true,
      raw_response: asJson(input.rawResponse),
    })
    .eq("id", transactionId);
  if (transactionError) {
    throw new Error(`Could not update failed transaction: ${transactionError.message}`);
  }
  return transactionId;
}

export async function refundGatewayPayment(input: {
  order: PaymentOrder;
  gateway: AsyncPaymentGateway;
  gatewayTransactionId: string;
  rawResponse: unknown;
}) {
  const transactionId = await findOrCreateEventTransaction({
    ...input,
    status: "refunded",
  });
  const { error } = await (
    supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("refund_async_payment", {
    _order_id: input.order.id,
    _gateway: input.gateway,
    _transaction_id: transactionId,
    _amount: money(input.order.total),
    _currency: input.order.currency.toUpperCase(),
  });
  if (error) throw new Error(`Could not record refund safely: ${error.message}`);

  const { error: transactionError } = await supabaseAdmin
    .from("payment_transactions")
    .update({
      status: "refunded",
      webhook_verified: true,
      raw_response: asJson(input.rawResponse),
    })
    .eq("id", transactionId);
  if (transactionError) {
    throw new Error(`Could not update refunded transaction: ${transactionError.message}`);
  }
  return transactionId;
}

export async function logPaymentWebhook(input: {
  gateway: string;
  eventType?: string | null;
  signature?: string | null;
  signatureValid: boolean;
  ip?: string | null;
  payload: unknown;
  processingError?: string | null;
  processed?: boolean;
  transactionId?: string | null;
}) {
  const { data } = await supabaseAdmin
    .from("payment_webhooks_log")
    .insert({
      gateway: input.gateway,
      event_type: input.eventType ?? null,
      signature: input.signature ?? null,
      signature_valid: input.signatureValid,
      ip_address: input.ip ?? null,
      payload: asJson(input.payload),
      processing_error: input.processingError ?? null,
      processed: input.processed ?? false,
      related_transaction_id: input.transactionId ?? null,
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export async function updatePaymentWebhookLog(
  id: string | null,
  update: {
    processed?: boolean;
    processing_error?: string | null;
    related_transaction_id?: string | null;
  },
) {
  if (!id) return;
  await supabaseAdmin.from("payment_webhooks_log").update(update).eq("id", id);
}
