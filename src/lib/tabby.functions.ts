// Tabby BNPL integration — creates a checkout session for an existing order
// and returns the hosted payment URL.
//
// Docs: https://docs.tabby.ai/reference/createsession
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TABBY_API = "https://api.tabby.ai/api/v2/checkout";

const InputSchema = z.object({
  order_id: z.string().uuid(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  failure_url: z.string().url(),
  lang: z.enum(["ar", "en"]).default("ar"),
});

export const createTabbyCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.TABBY_SECRET_KEY;
    if (!secret) throw new Error("TABBY_SECRET_KEY is not configured");

    // Load order + items
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
    // Tabby merchant_code per market: SAR→sa, AED→ae, KWD→kw, BHD→bh, QAR→qa
    const merchantMap: Record<string, string> = {
      SAR: "sa", AED: "ae", KWD: "kw", BHD: "bh", QAR: "qa",
    };
    const merchantCode = process.env.TABBY_MERCHANT_CODE || merchantMap[currency] || "sa";

    const payload = {
      payment: {
        amount: Number(order.total).toFixed(2),
        currency: order.currency || "AED",
        description: `Order ${order.order_number}`,
        buyer: {
          phone,
          email: order.customer_email,
          name: order.customer_name,
        },
        shipping_address: {
          city: String(addr.city || ""),
          address: String(addr.street || addr.geoAddress || addr.city || "—"),
          zip: String(addr.postalCode || ""),
        },
        order: {
          tax_amount: Number(order.tax).toFixed(2),
          shipping_amount: Number(order.shipping_fee).toFixed(2),
          discount_amount: Number(order.discount_amount || 0).toFixed(2),
          updated_at: new Date().toISOString(),
          reference_id: order.order_number,
          items: (items || []).map((it) => ({
            title: it.product_name,
            description: it.product_name,
            quantity: it.qty,
            unit_price: Number(it.unit_price).toFixed(2),
            discount_amount: "0.00",
            reference_id: it.product_slug,
            image_url: it.image_url || undefined,
            product_url: undefined,
            category: it.brand || "general",
          })),
        },
        buyer_history: {
          registered_since: order.created_at,
          loyalty_level: 0,
        },
        order_history: [],
        meta: {
          order_id: order.id,
          customer: order.user_id || order.customer_email,
        },
      },
      lang: data.lang,
      merchant_code: merchantCode,
      merchant_urls: {
        success: data.success_url,
        cancel: data.cancel_url,
        failure: data.failure_url,
      },
    };

    const res = await fetch(TABBY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Tabby createSession failed", res.status, json);
      throw new Error(
        json?.error || json?.errorType || `Tabby error ${res.status}`,
      );
    }

    // Pick the first available installments configuration URL
    const config =
      json?.configuration?.available_products?.installments?.[0] ||
      json?.configuration?.available_products?.pay_later?.[0];

    if (json?.status !== "created" || !config?.web_url) {
      // Customer rejected by Tabby — fall back
      return {
        ok: false as const,
        rejection: json?.configuration?.products?.installments?.[0]?.rejection_reason || "not_available",
        message: "تابي غير متاح لهذا الطلب حالياً. يرجى اختيار طريقة دفع أخرى.",
      };
    }

    // Save payment link on the order
    await supabaseAdmin
      .from("orders")
      .update({
        payment_link: config.web_url,
        payment_status: "pending_review",
        last_payment_attempt_at: new Date().toISOString(),
        payment_attempts: (order.payment_attempts || 0) + 1,
      })
      .eq("id", order.id);

    return {
      ok: true as const,
      session_id: json.id as string,
      web_url: config.web_url as string,
    };
  });

// Capture a Tabby payment after success (Tabby requires explicit capture)
export const captureTabbyPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ payment_id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env.TABBY_SECRET_KEY;
    if (!secret) throw new Error("TABBY_SECRET_KEY is not configured");

    // Fetch payment to get amount
    const getRes = await fetch(`https://api.tabby.ai/api/v2/payments/${data.payment_id}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const payment = await getRes.json();
    if (!getRes.ok) throw new Error(payment?.error || "Failed to fetch payment");

    const capRes = await fetch(
      `https://api.tabby.ai/api/v1/payments/${data.payment_id}/captures`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ amount: payment.amount }),
      },
    );
    const cap = await capRes.json().catch(() => ({}));
    return { ok: capRes.ok, payment, capture: cap };
  });
