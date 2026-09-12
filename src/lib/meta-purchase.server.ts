import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stableMetaEventId } from "@/lib/meta-events";
import { sendMetaCapiEvents } from "@/lib/meta-capi.server";

/** Emits Purchase only from an order whose payment is verified in the database. Never throws. */
export async function emitMetaPurchaseForPaidOrder(orderId: string): Promise<{ ok: boolean; skipped?: string }> {
  try {
    const token = process.env["META_CAPI_ACCESS_TOKEN"];
    if (!token) return { ok: false, skipped: "no_token" };
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,payment_status,total,currency,customer_email,customer_phone,shipping_address,order_items(product_id,variant_id,sku,qty,unit_price)")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || !["paid", "captured", "succeeded"].includes(order.payment_status)) {
      return { ok: false, skipped: "payment_not_verified" };
    }

    const eventId = stableMetaEventId("Purchase", order.id);
    const db = supabaseAdmin as any;
    const { data: existing } = await db.from("meta_capi_events").select("status").eq("event_id", eventId).maybeSingle();
    if (["sending", "sent"].includes(existing?.status)) return { ok: true, skipped: "duplicate" };

    let pixelId = process.env["META_PIXEL_ID"] || "";
    if (!pixelId) {
      const { data: pixel } = await supabaseAdmin.from("tracking_pixels").select("pixel_id").in("provider", ["meta", "instagram"]).eq("enabled", true).order("sort_order", { ascending: true }).limit(1).maybeSingle();
      pixelId = String(pixel?.pixel_id || "").trim();
    }
    if (!pixelId) return { ok: false, skipped: "no_pixel_id" };

    const address = (order.shipping_address || {}) as Record<string, unknown>;
    if (address.marketing_consent !== true) return { ok: false, skipped: "no_marketing_consent" };
    const { error: claimError } = await db.from("meta_capi_events").insert({ event_id: eventId, event_name: "Purchase", status: "sending", attempts: 1, order_id: order.id, last_attempt_at: new Date().toISOString() });
    if (claimError) return { ok: true, skipped: "duplicate" };
    const result = await sendMetaCapiEvents(pixelId, token, [{
      event_name: "Purchase",
      event_id: eventId,
      value: Number(order.total),
      currency: String(order.currency || "SAR").toUpperCase(),
      order_id: order.order_number,
      content_type: "product",
      contents: (order.order_items || []).map((item) => ({
        id: String(item.variant_id || item.product_id || item.sku || ""),
        quantity: Math.max(1, Number(item.qty) || 1),
        price: Math.max(0, Number(item.unit_price) || 0),
      })).filter((item) => item.id),
    }], {
      email: order.customer_email,
      phone: order.customer_phone,
      external_id: order.id,
      city: typeof address.city === "string" ? address.city : null,
      country: typeof address.countryCode === "string" ? address.countryCode : null,
    });
    await db.from("meta_capi_events").update({
      status: result.ok ? "sent" : "failed",
      provider_events_received: result.events_received ?? null,
      http_status: result.http_status ?? null,
      error_code: result.error_code ?? null,
      error_message: result.error?.slice(0, 300) ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
    }).eq("event_id", eventId);
    if (!result.ok) console.warn("[meta-capi] verified Purchase failed", { event_id: eventId, code: result.error_code, status: result.http_status });
    return { ok: result.ok };
  } catch {
    console.warn("[meta-capi] verified Purchase processing failed", { order_id: orderId });
    return { ok: false };
  }
}
