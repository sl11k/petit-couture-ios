import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckoutOrder, recordPaymentSession } from "@/lib/payment-gateway.server";
import { assertOrderTotals, money } from "@/lib/payment-validation";
import {
  TABBY_MERCHANT_CODES,
  convertPegged,
  isConvertibleCurrency,
  parseRequiredCurrency,
} from "@/lib/tabby-currency";

const TABBY_API = "https://api.tabby.ai/api/v2/checkout";
const InputSchema = z.object({
  order_id: z.string().uuid(),
  session_id: z.string().min(16).max(128),
  lang: z.enum(["ar", "en"]).default("ar"),
});

async function getTabbyIntegrationConfig() {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("api_key, api_secret, config")
    .eq("category", "payment")
    .eq("provider", "tabby")
    .eq("enabled", true)
    .maybeSingle();

  const config = (data?.config && typeof data.config === "object" ? data.config : {}) as Record<
    string,
    unknown
  >;
  return { row: data, config };
}

async function getTabbySecret() {
  const envSecret = String(process.env.TABBY_SECRET_KEY || "").trim();
  if (envSecret) return envSecret;

  const { row, config } = await getTabbyIntegrationConfig();
  const candidates = [
    row?.api_secret,
    config.secret_key,
    config.tabby_secret_key,
    config.api_secret,
  ].map((value) => String(value || "").trim());

  return candidates.find(Boolean) || null;
}

/**
 * A Tabby merchant account is bound to one settlement currency and one merchant
 * code. Ours settles in AED with merchant code "default", so we never guess the
 * code from the order currency any more — configuration wins, and the currency
 * is discovered from Tabby itself on the first rejection (then reused).
 */
async function getTabbyMerchantSettings(orderCurrency: string) {
  const { config } = await getTabbyIntegrationConfig();

  const envCode = String(process.env.TABBY_MERCHANT_CODE || "").trim();
  const configuredCode = String(config.merchant_code || config.tabby_merchant_code || "").trim();
  const merchantCode =
    envCode || configuredCode || TABBY_MERCHANT_CODES[orderCurrency] || "default";

  const envCurrency = String(process.env.TABBY_CURRENCY || "").trim().toUpperCase();
  const configuredCurrency = String(config.currency || config.tabby_currency || "")
    .trim()
    .toUpperCase();
  const currency = envCurrency || configuredCurrency || orderCurrency;

  return { merchantCode, currency };
}

/** Remember the settlement currency Tabby demanded so later orders skip the retry. */
async function rememberTabbyCurrency(currency: string) {
  try {
    const { row, config } = await getTabbyIntegrationConfig();
    if (!row) return;
    await supabaseAdmin
      .from("integrations")
      .select("id")
      .eq("category", "payment")
      .eq("provider", "tabby")
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data?.id) return;
        await supabaseAdmin
          .from("integrations")
          .update({ config: { ...config, currency } })
          .eq("id", data.id);
      });
  } catch (error) {
    console.error("[tabby] could not persist settlement currency", error);
  }
}

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
    const secret = await getTabbySecret();
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
    const orderCurrency = String(order.currency || "SAR").toUpperCase();
    const { merchantCode, currency: preferredCurrency } =
      await getTabbyMerchantSettings(orderCurrency);
    const origin = storefrontOrigin();

    const buildPayload = (currency: string) => {
      const to = currency.toUpperCase();
      const convert = (value: unknown) => convertPegged(money(value || 0), orderCurrency, to);

      const convertedItems = items.map((item) => ({
        title: item.product_name,
        description: item.product_name,
        quantity: item.qty,
        unit_price: convert(item.unit_price).toFixed(2),
        discount_amount: "0.00",
        reference_id: item.product_slug,
        image_url: item.image_url || undefined,
        category: item.brand || "general",
      }));

      // Keep Tabby's internal arithmetic exact: the payment amount is rebuilt
      // from the converted line items instead of converting the total on its own
      // (independent rounding of both sides can drift by a fils).
      const itemsSubtotal =
        Math.round(
          convertedItems.reduce(
            (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
            0,
          ) * 100,
        ) / 100;
      const shipping = convert(order.shipping_fee);
      const tax = convert(order.tax);
      const discount = convert(order.discount_amount);
      const amount = Math.round((itemsSubtotal + shipping + tax - discount) * 100) / 100;

      return {
        amount,
        payload: {
          payment: {
            amount: amount.toFixed(2),
            currency: to,
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
              tax_amount: tax.toFixed(2),
              shipping_amount: shipping.toFixed(2),
              discount_amount: discount.toFixed(2),
              updated_at: new Date().toISOString(),
              reference_id: order.order_number,
              items: convertedItems,
            },
            buyer_history: {
              registered_since: order.created_at,
              loyalty_level: 0,
            },
            order_history: [],
            meta: {
              order_id: order.id,
              order_currency: orderCurrency,
              order_total: money(order.total).toFixed(2),
            },
          },
          lang: data.lang,
          merchant_code: merchantCode,
          merchant_urls: {
            success: `${origin}/order-confirmation/${encodeURIComponent(order.order_number)}?tabby=success`,
            cancel: `${origin}/checkout?tabby=cancel`,
            failure: `${origin}/checkout?tabby=failure`,
          },
        },
      };
    };

    const send = async (currency: string) => {
      if (!isConvertibleCurrency(currency)) {
        throw new Error(`Tabby currency ${currency} is not supported by this store`);
      }
      const { payload, amount } = buildPayload(currency);
      const response = await fetch(TABBY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      return { response, result, amount, currency: currency.toUpperCase() };
    };

    let attempt = await send(preferredCurrency);

    // Tabby rejects an unsupported settlement currency with an explicit message
    // naming the required one — retry once in that currency and remember it.
    if (!attempt.response.ok) {
      const required = parseRequiredCurrency(attempt.result);
      if (required && required !== attempt.currency) {
        attempt = await send(required);
        if (attempt.response.ok) void rememberTabbyCurrency(required);
      }
    }

    const { response, result } = attempt;
    if (!response.ok) {
      console.error("Tabby checkout failed", response.status, result);
      throw new Error(
        result?.error || result?.errorType || `Tabby error ${response.status}`,
      );
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
      rawResponse: {
        ...result,
        settlement: { currency: attempt.currency, amount: attempt.amount },
      },
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
