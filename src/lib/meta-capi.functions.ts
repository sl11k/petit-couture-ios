import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { toMetaEventName } from "@/lib/meta-events";

const Input = z.object({
  marketing_consent: z.literal(true),
  event_name: z.enum(["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase"]),
  event_id: z.string().min(1).max(120),
  event_source_url: z.string().max(500).nullable().optional(),
  value: z.number().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  content_name: z.string().max(200).nullable().optional(),
  content_type: z.string().max(40).nullable().optional(),
  order_id: z.string().max(120).nullable().optional(),
  search_string: z.string().max(200).nullable().optional(),
  num_items: z.number().nullable().optional(),
  contents: z
    .array(z.object({ id: z.string().min(1).max(120), quantity: z.number().int().positive(), price: z.number().nonnegative().optional() }))
    .max(100)
    .optional(),
  user: z
    .object({
      email: z.string().max(255).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      external_id: z.string().max(120).nullable().optional(),
      fbp: z.string().max(200).nullable().optional(),
      fbc: z.string().max(300).nullable().optional(),
      city: z.string().max(120).nullable().optional(),
      country: z.string().max(60).nullable().optional(),
    })
    .optional(),
});

/**
 * Mirrors a storefront pixel event to the Meta Conversions API.
 * Fire-and-forget: returns { ok:false, skipped } when Meta is not configured.
 */
export const trackMetaConversion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const standardName = toMetaEventName(data.event_name);
    if (!standardName) return { ok: false, skipped: "invalid_event" as const };
    const token = process.env["META_CAPI_ACCESS_TOKEN"];
    if (!token) return { ok: false, skipped: "no_token" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMetaCapiEvents } = await import("@/lib/meta-capi.server");

    let pixelId = process.env["META_PIXEL_ID"] || "";
    if (!pixelId) {
      const { data: row } = await supabaseAdmin
        .from("tracking_pixels")
        .select("pixel_id")
        .in("provider", ["meta", "instagram"])
        .eq("enabled", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      pixelId = (row?.pixel_id ?? "").trim();
    }
    if (!pixelId) return { ok: false, skipped: "no_pixel_id" as const };

    let event = { ...data, event_name: standardName };
    let orderUuid: string | null = null;
    if (standardName === "Purchase") {
      if (!data.order_id) return { ok: false, skipped: "missing_order" as const };
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id,order_number,payment_status,total,currency,customer_email,customer_phone,shipping_address,order_items(product_id,variant_id,sku,qty,unit_price)")
        .eq("order_number", data.order_id)
        .maybeSingle();
      if (!order || !["paid", "captured", "succeeded"].includes(order.payment_status)) {
        return { ok: false, skipped: "payment_not_verified" as const };
      }
      orderUuid = order.id;
      const address = (order.shipping_address || {}) as Record<string, unknown>;
      event = {
        ...event,
        value: Number(order.total),
        currency: String(order.currency || "SAR").toUpperCase(),
        contents: (order.order_items || []).map((item) => ({
          id: String(item.variant_id || item.product_id || item.sku || ""),
          quantity: Math.max(1, Number(item.qty) || 1),
          price: Math.max(0, Number(item.unit_price) || 0),
        })).filter((item) => item.id),
        user: {
          ...(data.user || {}),
          email: order.customer_email,
          phone: order.customer_phone,
          city: typeof address.city === "string" ? address.city : data.user?.city,
          country: typeof address.countryCode === "string" ? address.countryCode : data.user?.country,
        },
      };
    }

    const db = supabaseAdmin as any;
    const { data: existing } = await db.from("meta_capi_events").select("status,attempts,last_attempt_at").eq("event_id", data.event_id).maybeSingle();
    if (existing?.status === "sent" || existing?.status === "sending") return { ok: true, skipped: "duplicate" as const };
    const attempts = (existing?.attempts || 0) + 1;
    const claim = {
      event_id: data.event_id,
      event_name: standardName,
      status: "sending",
      attempts,
      order_id: orderUuid,
      last_attempt_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    };
    if (existing) {
      const { data: claimed } = await db.from("meta_capi_events").update(claim).eq("event_id", data.event_id).in("status", ["retry", "failed"]).select("event_id").maybeSingle();
      if (!claimed) return { ok: true, skipped: "duplicate" as const };
    } else {
      const { error: claimError } = await db.from("meta_capi_events").insert(claim);
      if (claimError) return { ok: true, skipped: "duplicate" as const };
    }

    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const req = getRequest();
      ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        null;
      ua = req.headers.get("user-agent");
    } catch {
      /* no request context */
    }

    const res = await sendMetaCapiEvents(
      pixelId,
      token,
      [
        {
           event_name: standardName,
          event_id: data.event_id,
          event_source_url: data.event_source_url ?? null,
           value: event.value ?? null,
           currency: event.currency ?? null,
           content_name: event.content_name ?? null,
           content_type: event.content_type ?? null,
           order_id: event.order_id ?? null,
           search_string: event.search_string ?? null,
           num_items: event.num_items ?? null,
           contents: event.contents,
        },
      ],
      {
         ...(event.user ?? {}),
        client_ip_address: ip,
        client_user_agent: ua,
      },
      null,
    );
    await db.from("meta_capi_events").update({
      status: res.ok ? "sent" : attempts < 3 ? "retry" : "failed",
      provider_events_received: res.events_received ?? null,
      http_status: res.http_status ?? null,
      error_code: res.error_code ?? null,
      error_message: res.error?.slice(0, 300) ?? null,
      sent_at: res.ok ? new Date().toISOString() : null,
    }).eq("event_id", data.event_id);
    if (!res.ok) console.warn("[meta-capi] send failed", { event_name: standardName, event_id: data.event_id, code: res.error_code, status: res.http_status });
    return res;
  });
