import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckoutOrder, recordPaymentSession } from "@/lib/payment-gateway.server";
import { assertOrderTotals, money } from "@/lib/payment-validation";

const TABBY_API = "https://api.tabby.ai/api/v2/checkout";
const InputSchema = z.object({
  order_id: z.string().uuid(),
  session_id: z.string().min(16).max(128),
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

export const createTabbyCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.TABBY_SECRET_KEY;
    if (!secret) throw new Error("TABBY_SECRET_KEY is not configured");

    const order = await loadCheckoutOrder(data.order_id, data.session_id, "tabby");
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);
    if (itemsError) throw new Error("Failed to load order items");
    if (!items?.length) throw new Error("Order has no items");

    assertOrderTotals(items, order);

    const address = (order.shipping_address as Record<string, unknown>) || {};
    const phone = String(order.customer_phone || address.phone || "").replace(/\s/g, "");
    const currency = String(order.currency || "SAR").toUpperCase();
    const merchantCodes: Record<string, string> = {
      SAR: "sa",
      AED: "ae",
      KWD: "kw",
      BHD: "bh",
      QAR: "qa",
    };
    const merchantCode = process.env.TABBY_MERCHANT_CODE || merchantCodes[currency];
    if (!merchantCode) throw new Error(`Tabby does not support currency ${currency}`);
    const origin = storefrontOrigin();

    const payload = {
      payment: {
        amount: money(order.total).toFixed(2),
        currency,
        description: `Order ${order.order_number}`,
        buyer: {
          phone,
          email: order.customer_email,
          name: order.customer_name,
        },
        shipping_address: {
          city: String(address.city || ""),
          address: String(address.street || address.geoAddress || address.city || "—"),
          zip: String(address.postalCode || ""),
        },
        order: {
          tax_amount: money(order.tax || 0).toFixed(2),
          shipping_amount: money(order.shipping_fee || 0).toFixed(2),
          discount_amount: money(order.discount_amount || 0).toFixed(2),
          updated_at: new Date().toISOString(),
          reference_id: order.order_number,
          items: items.map((item) => ({
            title: item.product_name,
            description: item.product_name,
            quantity: item.qty,
            unit_price: money(item.unit_price).toFixed(2),
            discount_amount: "0.00",
            reference_id: item.product_slug,
            image_url: item.image_url || undefined,
            category: item.brand || "general",
          })),
        },
        buyer_history: {
          registered_since: order.created_at,
          loyalty_level: 0,
        },
        order_history: [],
        meta: { order_id: order.id },
      },
      lang: data.lang,
      merchant_code: merchantCode,
      merchant_urls: {
        success: `${origin}/order-confirmation/${encodeURIComponent(order.order_number)}?tabby=success`,
        cancel: `${origin}/checkout?tabby=cancel`,
        failure: `${origin}/checkout?tabby=failure`,
      },
    };

    const response = await fetch(TABBY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Tabby checkout failed", response.status, result);
      throw new Error(result?.error || result?.errorType || `Tabby error ${response.status}`);
    }

    const configuration =
      result?.configuration?.available_products?.installments?.[0] ||
      result?.configuration?.available_products?.pay_later?.[0];
    if (result?.status !== "created" || !configuration?.web_url) {
      return {
        ok: false as const,
        rejection:
          result?.configuration?.products?.installments?.[0]?.rejection_reason || "not_available",
        message:
          data.lang === "ar"
            ? "تابي غير متاح لهذا الطلب حاليًا. يرجى اختيار طريقة دفع أخرى."
            : "Tabby is not available for this order. Please choose another payment method.",
      };
    }

    const transactionId = await recordPaymentSession({
      order,
      gateway: "tabby",
      gatewayReference: String(result.id || "") || null,
      rawResponse: result,
    });
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_link: configuration.web_url,
        payment_status: "pending_review",
        payment_gateway: "tabby",
        last_transaction_id: transactionId,
        last_payment_attempt_at: new Date().toISOString(),
        payment_attempts: Number(order.payment_attempts || 0) + 1,
      })
      .eq("id", order.id);
    if (updateError) throw new Error(`Failed to save Tabby session: ${updateError.message}`);

    return {
      ok: true as const,
      session_id: result.id as string,
      web_url: configuration.web_url as string,
    };
  });
