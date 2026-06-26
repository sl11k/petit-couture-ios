import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("stripe-signature") || "";
        const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
        const secret = await getStripeWebhookSecret();

        if (!secret) {
          console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
          return new Response("Stripe webhook is not configured", { status: 503 });
        }

        const signatureValid = verifyStripeSignature(body, signature, secret);
        let event: StripeEvent | null = null;
        try {
          event = JSON.parse(body) as StripeEvent;
        } catch {
          await logStripeWebhook({
            signature,
            signatureValid: false,
            ip,
            payload: { raw: body.slice(0, 500) },
            processingError: "Invalid JSON",
          });
          return new Response("Invalid JSON", { status: 400 });
        }

        const logId = await logStripeWebhook({
          eventType: event.type,
          signature,
          signatureValid,
          ip,
          payload: event,
        });

        if (!signatureValid) {
          await markWebhookLog(logId, { processing_error: "Invalid Stripe signature" });
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const object = event.data.object;
          if (
            event.type === "checkout.session.completed" ||
            event.type === "checkout.session.async_payment_succeeded"
          ) {
            const result = await completeStripeCheckout(object, event);
            await markWebhookLog(logId, {
              processed: true,
              related_transaction_id: result.transactionId,
            });
            return json({ ok: true });
          }

          if (
            event.type === "checkout.session.expired" ||
            event.type === "payment_intent.payment_failed"
          ) {
            const result = await failStripeCheckout(object, event);
            await markWebhookLog(logId, {
              processed: true,
              related_transaction_id: result.transactionId,
            });
            return json({ ok: true });
          }

          await markWebhookLog(logId, { processed: true });
          return json({ ok: true, ignored: true });
        } catch (err) {
          await markWebhookLog(logId, {
            processing_error: err instanceof Error ? err.message : "Unknown Stripe webhook error",
          });
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});

async function getStripeWebhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;

  const { data } = await supabaseAdmin
    .from("integrations")
    .select("webhook_secret, config")
    .eq("category", "payment")
    .eq("provider", "stripe")
    .eq("enabled", true)
    .maybeSingle();

  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<
    string,
    unknown
  >;
  return (
    String(data?.webhook_secret || "").trim() ||
    String(config.webhook_secret || config.stripe_webhook_secret || "").trim() ||
    null
  );
}

function verifyStripeSignature(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((part) => part.split("="))
      .filter((part): part is [string, string] => part.length === 2),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

function metadataValue(object: Record<string, unknown>, key: string) {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function orderNumberFromStripeObject(object: Record<string, unknown>) {
  return (
    metadataValue(object, "order_number") ||
    (typeof object.client_reference_id === "string" ? object.client_reference_id : null)
  );
}

async function completeStripeCheckout(object: Record<string, unknown>, event: StripeEvent) {
  const sessionId = String(object.id || "");
  const orderNumber = orderNumberFromStripeObject(object);
  if (!sessionId || !orderNumber) throw new Error("Stripe session is missing order metadata");

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id,total,currency,user_id,payment_method,payment_status")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (orderError || !order) throw new Error("Order not found for Stripe webhook");

  const amount = Number(object.amount_total ?? 0) / 100;
  const currency = String(object.currency || "SAR").toUpperCase();
  if (Math.abs(Number(order.total) - amount) > 0.01) throw new Error("Stripe amount mismatch");
  if (String(order.currency).toUpperCase() !== currency)
    throw new Error("Stripe currency mismatch");

  const transactionId = await findOrCreateStripeTransaction({
    orderId: order.id,
    orderNumber,
    sessionId,
    amount,
    currency,
    status: "captured",
    event,
  });

  const { error: completeError } = await (
    supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("complete_async_payment", {
    _order_id: order.id,
    _gateway: order.payment_method,
    _gateway_transaction_id: sessionId,
    _transaction_id: transactionId,
    _amount: amount,
    _currency: currency,
  });
  if (completeError) {
    throw new Error(`Could not finalize Stripe payment safely: ${completeError.message}`);
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      payment_gateway: "stripe",
      last_transaction_id: transactionId,
      captured_amount: amount,
    })
    .eq("id", order.id);
  if (error) throw new Error(`Could not mark Stripe order as paid: ${error.message}`);

  try {
    const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
    const res = await createOtoShipmentForOrder(order.id, order.user_id ?? null);
    if (!res.ok) console.error("[stripe-webhook] OTO auto-create failed:", res.error);
  } catch (err) {
    console.error("[stripe-webhook] OTO auto-create threw:", err);
  }

  return { transactionId };
}

async function failStripeCheckout(object: Record<string, unknown>, event: StripeEvent) {
  const sessionId = String(object.id || object.latest_charge || object.payment_intent || event.id);
  const orderNumber = orderNumberFromStripeObject(object);
  if (!orderNumber) return { transactionId: null };

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,total,currency,payment_method")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) return { transactionId: null };

  const transactionId = await findOrCreateStripeTransaction({
    orderId: order.id,
    orderNumber,
    sessionId,
    amount: Number(order.total),
    currency: String(order.currency || "SAR").toUpperCase(),
    status: "failed",
    event,
  });

  const { error: failError } = await (
    supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("fail_async_payment", {
    _order_id: order.id,
    _gateway: order.payment_method,
    _transaction_id: transactionId,
    _reason: event.type,
  });
  if (failError) throw new Error(`Could not fail Stripe payment safely: ${failError.message}`);

  await supabaseAdmin
    .from("orders")
    .update({
      payment_failure_reason: event.type,
      last_payment_attempt_at: new Date().toISOString(),
      payment_gateway: "stripe",
      last_transaction_id: transactionId,
    })
    .eq("id", order.id);

  return { transactionId };
}

async function findOrCreateStripeTransaction(input: {
  orderId: string;
  orderNumber: string;
  sessionId: string;
  amount: number;
  currency: string;
  status: "captured" | "failed";
  event: StripeEvent;
}) {
  const { data: existing } = await supabaseAdmin
    .from("payment_transactions")
    .select("id")
    .eq("gateway", "stripe")
    .eq("gateway_transaction_id", input.sessionId)
    .maybeSingle();

  const update = {
    status: input.status,
    raw_response: input.event as never,
    webhook_verified: true,
    updated_at: new Date().toISOString(),
    ...(input.status === "captured"
      ? { captured_at: new Date().toISOString() }
      : { failed_at: new Date().toISOString(), error_message: input.event.type }),
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("payment_transactions")
      .update(update)
      .eq("id", existing.id);
    if (error) throw new Error(`Could not update Stripe transaction: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin
    .from("payment_transactions")
    .insert({
      order_id: input.orderId,
      order_number: input.orderNumber,
      amount: input.amount,
      currency: input.currency,
      gateway: "stripe",
      gateway_transaction_id: input.sessionId,
      idempotency_key: `stripe:webhook:${input.sessionId}`,
      ...update,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create Stripe transaction: ${error?.message}`);
  return data.id;
}

async function logStripeWebhook(input: {
  eventType?: string;
  signature: string;
  signatureValid: boolean;
  ip: string;
  payload: unknown;
  processingError?: string;
}) {
  const { data } = await supabaseAdmin
    .from("payment_webhooks_log")
    .insert({
      gateway: "stripe",
      event_type: input.eventType ?? null,
      signature: input.signature,
      signature_valid: input.signatureValid,
      ip_address: input.ip,
      payload: input.payload as never,
      processing_error: input.processingError ?? null,
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

async function markWebhookLog(id: string | null, update: Record<string, unknown>) {
  if (!id) return;
  await supabaseAdmin
    .from("payment_webhooks_log")
    .update(update as never)
    .eq("id", id);
}

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
