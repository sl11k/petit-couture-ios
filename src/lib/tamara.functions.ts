// Tamara BNPL integration — creates a checkout session for an existing order
// and returns the hosted payment URL.
// Docs: https://docs.tamara.co/reference/create-checkout-session
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Production: https://api.tamara.co
// Sandbox:    https://api-sandbox.tamara.co
const TAMARA_API = process.env.TAMARA_API_URL || "https://api.tamara.co";

const InputSchema = z.object({
  order_id: z.string().uuid(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  failure_url: z.string().url(),
  notification_url: z.string().url(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export const createTamaraCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const token = process.env.TAMARA_API_TOKEN;
    if (!token) throw new Error("TAMARA_API_TOKEN is not configured");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", data.order_id);
    if (itemsErr) throw new Error("Failed to load order items");

    const addr = (order.shipping_address as Record<string, unknown>) || {};
    const phone = String(order.customer_phone || addr.phone || "").replace(/\s/g, "");
    const currency = (order.currency || "SAR").toUpperCase();
    // Tamara country code: SAR→SA, AED→AE, KWD→KW, BHD→BH
    const countryMap: Record<string, string> = {
      SAR: "SA", AED: "AE", KWD: "KW", BHD: "BH", QAR: "QA", OMR: "OM",
    };
    const country_code = countryMap[currency] || "SA";

    const amount = (n: number) => ({
      amount: Number(n).toFixed(2),
      currency,
    });

    const payload = {
      order_reference_id: order.order_number,
      order_number: order.order_number,
      total_amount: amount(Number(order.total)),
      tax_amount: amount(Number(order.tax || 0)),
      shipping_amount: amount(Number(order.shipping_fee || 0)),
      discount: {
        name: "discount",
        amount: amount(0),
      },
      description: `Order ${order.order_number}`,
      country_code,
      payment_type: "PAY_BY_INSTALMENTS",
      instalments: 4,
      locale: data.lang === "ar" ? "ar_SA" : "en_US",
      items: (items || []).map((it) => ({
        reference_id: it.product_slug,
        type: "Physical",
        name: it.product_name,
        sku: it.product_slug,
        quantity: it.qty,
        total_amount: amount(Number(it.unit_price) * it.qty),
        unit_price: amount(Number(it.unit_price)),
        tax_amount: amount(0),
        discount_amount: amount(0),
        image_url: it.image_url || undefined,
      })),
      consumer: {
        first_name: String(order.customer_name || "").split(" ")[0] || "Customer",
        last_name: String(order.customer_name || "").split(" ").slice(1).join(" ") || "—",
        phone_number: phone,
        email: order.customer_email,
      },
      shipping_address: {
        first_name: String(order.customer_name || "").split(" ")[0] || "Customer",
        last_name: String(order.customer_name || "").split(" ").slice(1).join(" ") || "—",
        line1: String(addr.street || addr.geoAddress || addr.city || "—"),
        line2: String(addr.district || ""),
        region: String(addr.city || ""),
        city: String(addr.city || ""),
        country_code,
        phone_number: phone,
      },
      billing_address: {
        first_name: String(order.customer_name || "").split(" ")[0] || "Customer",
        last_name: String(order.customer_name || "").split(" ").slice(1).join(" ") || "—",
        line1: String(addr.street || addr.geoAddress || addr.city || "—"),
        line2: String(addr.district || ""),
        region: String(addr.city || ""),
        city: String(addr.city || ""),
        country_code,
        phone_number: phone,
      },
      merchant_url: {
        success: data.success_url,
        failure: data.failure_url,
        cancel: data.cancel_url,
        notification: data.notification_url,
      },
      platform: "Lovable",
      is_mobile: false,
      additional_data: {
        order_id: order.id,
      },
    };

    const res = await fetch(`${TAMARA_API}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Tamara checkout failed", res.status, json);
      const message =
        json?.message ||
        json?.error_message ||
        (Array.isArray(json?.errors) && json.errors[0]?.error_code) ||
        `Tamara error ${res.status}`;
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? `تمارا غير متاحة لهذا الطلب: ${message}`
            : `Tamara not available: ${message}`,
      };
    }

    const checkout_url = json?.checkout_url as string | undefined;
    const checkout_id = json?.checkout_id as string | undefined;
    const order_id_tamara = json?.order_id as string | undefined;

    if (!checkout_url) {
      return {
        ok: false as const,
        message:
          data.lang === "ar"
            ? "تعذّر إنشاء جلسة الدفع لدى تمارا"
            : "Could not create Tamara checkout session",
      };
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_link: checkout_url,
        payment_status: "pending_review",
        last_payment_attempt_at: new Date().toISOString(),
        payment_attempts: (order.payment_attempts || 0) + 1,
      })
      .eq("id", order.id);

    return {
      ok: true as const,
      checkout_id,
      tamara_order_id: order_id_tamara,
      checkout_url,
    };
  });

// Authorize then capture a Tamara order after the customer approves.
// Tamara flow: status `approved` → call /orders/{id}/authorise → `authorised`
// → call /payments/capture for the captured amount → `fully_captured` (paid).
export const captureTamaraPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ tamara_order_id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const token = process.env.TAMARA_API_TOKEN;
    if (!token) throw new Error("TAMARA_API_TOKEN is not configured");

    // 1) Authorise
    const authRes = await fetch(
      `${TAMARA_API}/orders/${data.tamara_order_id}/authorise`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const authJson = await authRes.json().catch(() => ({}));

    // 2) Fetch order for amount
    const ordRes = await fetch(`${TAMARA_API}/orders/${data.tamara_order_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ordJson = await ordRes.json();
    if (!ordRes.ok) throw new Error(ordJson?.message || "Failed to fetch Tamara order");

    // 3) Capture full amount
    const capRes = await fetch(`${TAMARA_API}/payments/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        order_id: data.tamara_order_id,
        total_amount: ordJson.total_amount,
        tax_amount: ordJson.tax_amount,
        shipping_amount: ordJson.shipping_amount,
        discount_amount: ordJson.discount_amount,
        items: ordJson.items,
        shipping_info: {
          shipped_at: new Date().toISOString(),
          shipping_company: "—",
          tracking_number: "—",
          tracking_url: "",
        },
      }),
    });
    const capJson = await capRes.json().catch(() => ({}));
    return { ok: capRes.ok, authorise: authJson, capture: capJson, order: ordJson };
  });
