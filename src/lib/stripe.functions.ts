import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckoutOrder, recordPaymentSession } from "@/lib/payment-gateway.server";
import { assertOrderTotals, money } from "@/lib/payment-validation";

const STRIPE_CHECKOUT_SESSIONS_API = "https://api.stripe.com/v1/checkout/sessions";

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
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;

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
  ].map((value) => String(value || "").trim());

  return candidates.find((value) => value.startsWith("sk_")) || null;
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

    const origin = storefrontOrigin();
    const currency = String(order.currency || "SAR").toLowerCase();
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("locale", data.lang === "ar" ? "ar" : "en");
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

    items.forEach((item, index) => appendLineItem(params, index, { ...item, currency }));

    const response = await fetch(STRIPE_CHECKOUT_SESSIONS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Stripe checkout failed", response.status, result);
      const message = result?.error?.message || `Stripe error ${response.status}`;
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
