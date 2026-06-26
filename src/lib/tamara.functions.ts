import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckoutOrder, recordPaymentSession } from "@/lib/payment-gateway.server";
import { assertOrderTotals, money } from "@/lib/payment-validation";

const TAMARA_API = process.env.TAMARA_API_URL || "https://api.tamara.co";
const InputSchema = z.object({
  order_id: z.string().uuid(),
  session_id: z.string().min(16).max(128),
  lang: z.enum(["ar", "en"]).default("ar"),
});

async function getTamaraToken() {
  if (process.env.TAMARA_API_TOKEN) return process.env.TAMARA_API_TOKEN;

  const { data } = await supabaseAdmin
    .from("integrations")
    .select("api_key, api_secret, config")
    .eq("category", "payment")
    .eq("provider", "tamara")
    .eq("enabled", true)
    .maybeSingle();

  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<
    string,
    unknown
  >;
  const candidates = [
    data?.api_secret,
    config.api_token,
    config.tamara_api_token,
    config.secret_key,
    data?.api_key,
  ].map((value) => String(value || "").trim());

  return candidates.find(Boolean) || null;
}

function storefrontOrigin() {
  const configured = process.env.STOREFRONT_URL || process.env.SITE_URL;
  const origin = configured ? new URL(configured).origin : new URL(getRequest().url).origin;
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("STOREFRONT_URL must use HTTPS in production");
  }
  return origin;
}

export const createTamaraCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const token = await getTamaraToken();
    if (!token) throw new Error("TAMARA_API_TOKEN is not configured");

    const order = await loadCheckoutOrder(data.order_id, data.session_id, "tamara");
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);
    if (itemsError) throw new Error("Failed to load order items");
    if (!items?.length) throw new Error("Order has no items");

    assertOrderTotals(items, order);

    const address = (order.shipping_address as Record<string, unknown>) || {};
    const phone = String(order.customer_phone || address.phone || "").replace(/\s/g, "");
    const names = String(order.customer_name || "Customer")
      .trim()
      .split(/\s+/);
    const firstName = names[0] || "Customer";
    const lastName = names.slice(1).join(" ") || "—";
    const currency = String(order.currency || "SAR").toUpperCase();
    const countryCodes: Record<string, string> = {
      SAR: "SA",
      AED: "AE",
      KWD: "KW",
      BHD: "BH",
      QAR: "QA",
      OMR: "OM",
    };
    const countryCode = countryCodes[currency];
    if (!countryCode) throw new Error(`Tamara does not support currency ${currency}`);
    const amount = (value: unknown) => ({ amount: money(value).toFixed(2), currency });
    const origin = storefrontOrigin();

    const payload = {
      order_reference_id: order.order_number,
      order_number: order.order_number,
      total_amount: amount(order.total),
      tax_amount: amount(order.tax || 0),
      shipping_amount: amount(order.shipping_fee || 0),
      discount: {
        name: String(order.coupon_code || "discount"),
        amount: amount(order.discount_amount || 0),
      },
      description: `Order ${order.order_number}`,
      country_code: countryCode,
      payment_type: "PAY_BY_INSTALMENTS",
      instalments: 4,
      locale: data.lang === "ar" ? "ar_SA" : "en_US",
      items: items.map((item) => ({
        reference_id: item.product_slug,
        type: "Physical",
        name: item.product_name,
        sku: item.product_slug,
        quantity: item.qty,
        total_amount: amount(Number(item.unit_price) * Number(item.qty)),
        unit_price: amount(item.unit_price),
        tax_amount: amount(0),
        discount_amount: amount(0),
        image_url: item.image_url || undefined,
      })),
      consumer: {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        email: order.customer_email,
      },
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        line1: String(address.street || address.geoAddress || address.city || "—"),
        line2: String(address.district || ""),
        region: String(address.city || ""),
        city: String(address.city || ""),
        country_code: countryCode,
        phone_number: phone,
      },
      billing_address: {
        first_name: firstName,
        last_name: lastName,
        line1: String(address.street || address.geoAddress || address.city || "—"),
        line2: String(address.district || ""),
        region: String(address.city || ""),
        city: String(address.city || ""),
        country_code: countryCode,
        phone_number: phone,
      },
      merchant_url: {
        success: `${origin}/order-confirmation/${encodeURIComponent(order.order_number)}?tamara=success`,
        failure: `${origin}/checkout?tamara=failure`,
        cancel: `${origin}/checkout?tamara=cancel`,
        notification: `${origin}/api/public/tamara-webhook`,
      },
      platform: "Le Petit Paradis",
      is_mobile: false,
      additional_data: { order_id: order.id },
    };

    const response = await fetch(`${TAMARA_API}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Tamara checkout failed", response.status, result);
      const detail =
        result?.message ||
        result?.error_message ||
        (Array.isArray(result?.errors) && result.errors[0]?.error_code) ||
        `Tamara error ${response.status}`;
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? `تمارا غير متاحة لهذا الطلب: ${detail}`
            : `Tamara is not available: ${detail}`,
      };
    }

    const checkoutUrl = result?.checkout_url as string | undefined;
    if (!checkoutUrl) {
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? "تعذّر إنشاء جلسة الدفع لدى تمارا"
            : "Could not create a Tamara checkout session",
      };
    }

    const transactionId = await recordPaymentSession({
      order,
      gateway: "tamara",
      gatewayReference: result?.checkout_id || null,
      gatewayTransactionId: result?.order_id || null,
      rawResponse: result,
    });
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_link: checkoutUrl,
        payment_status: "pending_review",
        payment_gateway: "tamara",
        last_transaction_id: transactionId,
        last_payment_attempt_at: new Date().toISOString(),
        payment_attempts: Number(order.payment_attempts || 0) + 1,
      })
      .eq("id", order.id);
    if (updateError) throw new Error(`Failed to save Tamara session: ${updateError.message}`);

    return {
      ok: true as const,
      checkout_id: result?.checkout_id as string | undefined,
      tamara_order_id: result?.order_id as string | undefined,
      checkout_url: checkoutUrl,
    };
  });
