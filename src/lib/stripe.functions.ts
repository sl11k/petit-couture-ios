import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckoutOrder, recordPaymentSession } from "@/lib/payment-gateway.server";
import { assertOrderTotals, money } from "@/lib/payment-validation";

const STRIPE_CHECKOUT_SESSIONS_API = "https://api.stripe.com/v1/checkout/sessions";
const STRIPE_COUPONS_API = "https://api.stripe.com/v1/coupons";
const MIN_CARD_TOTAL_SAR = 3;

const InputSchema = z.object({
  order_id: z.string().uuid(),
  session_id: z.string().min(16).max(128),
  method: z.enum(["card", "apple_pay"]).default("card"),
  lang: z.enum(["ar", "en"]).default("ar"),
});

function storefrontOrigin() {
  const configured = process.env.STOREFRONT_URL || process.env.SITE_URL;
  const origin = configured ? new URL(configured).origin : new URL(getRequest().url).origin;
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("STOREFRONT_URL must use HTTPS in production");
  }
  return origin;
}

async function getStripeSecret() {
  // Prefer an explicitly configured Stripe secret in the DB so site owners
  // can rotate keys without redeploying. Fall back to `process.env.STRIPE_SECRET_KEY`.
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("api_key, api_secret, config")
    .eq("category", "payment")
    .eq("provider", "stripe")
    .eq("enabled", true)
    .maybeSingle();

  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<
    string,
    unknown
  >;
  const candidates = [
    data?.api_secret,
    config.secret_key,
    config.stripe_secret_key,
    data?.api_key,
    process.env.STRIPE_SECRET_KEY,
  ].map((value) => String(value || "").trim());

  // Accept both sk_ (live) and sk_test_ (test) keys
  const found = candidates.find((value) => value.startsWith("sk_")) || null;
  if (found) return found;
  // Helpful debug hint when no key found.
  console.error("Stripe secret not found in integrations table or STRIPE_SECRET_KEY env var. Candidates checked:", candidates.map(c => c ? `${c.substring(0, 8)}...` : 'null'));
  return null;
}

function appendLineItem(params: URLSearchParams, index: number, item: Record<string, unknown>) {
  const name = String(item.product_name || "Product").slice(0, 120);
  const imageUrl = String(item.image_url || "").trim();
  params.set(`line_items[${index}][quantity]`, String(Math.max(1, Number(item.qty || 1))));
  params.set(
    `line_items[${index}][price_data][currency]`,
    String(item.currency || "sar").toLowerCase(),
  );
  params.set(
    `line_items[${index}][price_data][unit_amount]`,
    String(Math.max(0, Math.round(money(item.unit_price) * 100))),
  );
  params.set(`line_items[${index}][price_data][product_data][name]`, name);
  if (/^https:\/\//i.test(imageUrl)) {
    params.set(`line_items[${index}][price_data][product_data][images][0]`, imageUrl);
  }
}

function appendAdjustmentLineItem(
  params: URLSearchParams,
  index: number,
  input: { name: string; amount: unknown; currency: string },
) {
  const amount = Math.round(money(input.amount) * 100);
  if (amount <= 0) return false;
  params.set(`line_items[${index}][quantity]`, "1");
  params.set(`line_items[${index}][price_data][currency]`, input.currency.toLowerCase());
  params.set(`line_items[${index}][price_data][unit_amount]`, String(amount));
  params.set(`line_items[${index}][price_data][product_data][name]`, input.name.slice(0, 120));
  return true;
}

async function createStripeDiscountCoupon(input: {
  secret: string;
  orderId: string;
  amount: unknown;
  currency: string;
}) {
  const amountOff = Math.round(money(input.amount) * 100);
  if (amountOff <= 0) return null;
  const params = new URLSearchParams();
  params.set("amount_off", String(amountOff));
  params.set("currency", input.currency.toLowerCase());
  params.set("duration", "once");
  params.set("name", "Order discount");

  const response = await fetch(STRIPE_COUPONS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `coupon:${input.orderId}:${amountOff}`,
    },
    body: params,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.error?.message || `Stripe coupon error ${response.status}`;
    throw new Error(message);
  }
  return result?.id ? String(result.id) : null;
}

export const createStripeCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = await getStripeSecret();
    if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");

    const order = await loadCheckoutOrder(data.order_id, data.session_id, data.method);
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);
    if (itemsError) throw new Error("Failed to load order items");
    if (!items?.length) throw new Error("Order has no items");

    assertOrderTotals(items, order);

    if (money(order.total) < MIN_CARD_TOTAL_SAR) {
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? `الحد الأدنى للدفع بالبطاقة أو Apple Pay هو ${MIN_CARD_TOTAL_SAR.toFixed(2)} ر.س تقريبًا. اختر وسيلة دفع أخرى أو زد قيمة الطلب.`
            : `The minimum total for card or Apple Pay is about ${MIN_CARD_TOTAL_SAR.toFixed(2)} SAR. Please choose another payment method or increase the order total.`,
      };
    }

    const origin = storefrontOrigin();
    const currency = String(order.currency || "SAR").toLowerCase();
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("locale", data.lang === "ar" ? "auto" : "en");
    params.set("client_reference_id", order.order_number);
    params.set("customer_email", order.customer_email);
    params.set(
      "success_url",
      `${origin}/order-confirmation/${encodeURIComponent(order.order_number)}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    );
    params.set("cancel_url", `${origin}/checkout?stripe=cancel`);
    params.set("payment_method_types[0]", "card");
    params.set("metadata[order_id]", order.id);
    params.set("metadata[order_number]", order.order_number);
    params.set("payment_intent_data[metadata][order_id]", order.id);
    params.set("payment_intent_data[metadata][order_number]", order.order_number);

    let lineIndex = 0;
    items.forEach((item) => {
      appendLineItem(params, lineIndex, { ...item, currency });
      lineIndex += 1;
    });
    if (
      appendAdjustmentLineItem(params, lineIndex, {
        name: data.lang === "ar" ? "الشحن" : "Shipping",
        amount: order.shipping_fee || 0,
        currency,
      })
    ) {
      lineIndex += 1;
    }
    if (
      appendAdjustmentLineItem(params, lineIndex, {
        name: data.lang === "ar" ? "ضريبة القيمة المضافة" : "VAT",
        amount: order.tax || 0,
        currency,
      })
    ) {
      lineIndex += 1;
    }

    const couponId = await createStripeDiscountCoupon({
      secret,
      orderId: order.id,
      amount: order.discount_amount || 0,
      currency,
    });
    if (couponId) params.set("discounts[0][coupon]", couponId);

    const response = await fetch(STRIPE_CHECKOUT_SESSIONS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `checkout:${order.id}`,
      },
      body: params,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Stripe checkout failed", response.status, result);
      const rawMessage = String(result?.error?.message || "");
      const message =
        /at least 200 fils/i.test(rawMessage) || /total amount must convert to at least/i.test(rawMessage)
          ? data.lang === "ar"
            ? `الحد الأدنى للدفع بالبطاقة أو Apple Pay هو ${MIN_CARD_TOTAL_SAR.toFixed(2)} ر.س تقريبًا. اختر وسيلة دفع أخرى أو زد قيمة الطلب.`
            : `The minimum total for card or Apple Pay is about ${MIN_CARD_TOTAL_SAR.toFixed(2)} SAR. Please choose another payment method or increase the order total.`
          : rawMessage || `Stripe error ${response.status}`;
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? `تعذّر بدء دفع البطاقة: ${message}`
            : `Could not start card payment: ${message}`,
      };
    }

    const checkoutUrl = result?.url as string | undefined;
    const sessionId = result?.id as string | undefined;
    if (!checkoutUrl || !sessionId) {
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? "تعذّر إنشاء رابط دفع Stripe"
            : "Could not create a Stripe checkout link",
      };
    }

    const transactionId = await recordPaymentSession({
      order,
      gateway: "stripe",
      gatewayReference: result?.payment_intent || null,
      gatewayTransactionId: sessionId,
      rawResponse: result,
    });
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_link: checkoutUrl,
        payment_status: "pending_review",
        payment_gateway: "stripe",
        last_transaction_id: transactionId,
        last_payment_attempt_at: new Date().toISOString(),
        payment_attempts: Number(order.payment_attempts || 0) + 1,
      })
      .eq("id", order.id);
    if (updateError) throw new Error(`Failed to save Stripe session: ${updateError.message}`);

    return {
      ok: true as const,
      session_id: sessionId,
      checkout_url: checkoutUrl,
    };
  });


const STRIPE_REFUNDS_API = "https://api.stripe.com/v1/refunds";

const RefundSchema = z.object({
  transaction_id: z.string().uuid(),
  amount: z.number().min(0.01).optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer", "expired_uncaptured_charge"]).optional(),
});

export const createStripeRefund = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RefundSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = await getStripeSecret();
    if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");

    // Get the transaction to find the charge/payment intent
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("id", data.transaction_id)
      .maybeSingle();

    if (transactionError || !transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.gateway !== "stripe") {
      throw new Error("This transaction is not from Stripe");
    }

    if (transaction.status !== "captured") {
      throw new Error("Can only refund captured transactions");
    }

    const chargeId = transaction.gateway_transaction_id;
    if (!chargeId) {
      throw new Error("Transaction is missing gateway charge id");
    }
    const refundAmount = data.amount ? Math.round(data.amount * 100) : Math.round(transaction.amount * 100);

    const params = new URLSearchParams();
    params.set("charge", chargeId);
    params.set("amount", String(refundAmount));
    if (data.reason) {
      params.set("reason", data.reason);
    }
    params.set("metadata[order_id]", transaction.order_id || "");
    params.set("metadata[order_number]", transaction.order_number || "");
    params.set("metadata[transaction_id]", transaction.id);

    const response = await fetch(STRIPE_REFUNDS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `refund:${transaction.id}:${refundAmount}`,
      },
      body: params,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.error?.message || `Stripe refund error ${response.status}`;
      throw new Error(message);
    }

    const refundId = result?.id as string | undefined;
    if (!refundId) {
      throw new Error("Stripe did not return a refund ID");
    }

    // Create refund transaction record
    const { data: refundTransaction, error: refundError } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        order_id: transaction.order_id,
        order_number: transaction.order_number,
        amount: refundAmount / 100,
        currency: transaction.currency,
        gateway: "stripe",
        gateway_transaction_id: refundId,
        status: "refunded",
        raw_response: result as never,
        webhook_verified: true,
        metadata: { parent_transaction_id: transaction.id, refund_reason: data.reason || "admin_refund" } as never,
      })
      .select("id")
      .single();

    if (refundError || !refundTransaction) {
      throw new Error(`Could not create refund transaction: ${refundError?.message}`);
    }

    // Update order with refund info
    const { error: orderError } = await supabaseAdmin
      .from("orders")
      .update({
        refunded_amount: (await supabaseAdmin
          .from("payment_transactions")
          .select("amount")
          .eq("order_id", transaction.order_id || "")
          .eq("status", "refunded")
          .then(({ data }) => data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0)) + (refundAmount / 100),
        last_transaction_id: refundTransaction.id,
      })
      .eq("id", transaction.order_id || "");

    if (orderError) {
      console.error(`[stripe-refund] Could not update order refund amount: ${orderError.message}`);
    }

    return {
      ok: true as const,
      refund_id: refundId,
      amount: refundAmount / 100,
      transaction_id: refundTransaction.id,
    };
  });
