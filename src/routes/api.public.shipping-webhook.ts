import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Public shipping webhook endpoint.
 * Carriers POST tracking updates here.
 *
 * Security: HMAC-SHA256 with SHIPPING_WEBHOOK_SECRET.
 *
 * Expected payload:
 * {
 *   carrier_code: "aramex" | "smsa" | ...,
 *   tracking_number: "ABC123",
 *   event_type: "in_transit" | "delivered" | ...,
 *   status: "in_transit" | "delivered" | "failed_delivery" | "returned" | "lost",
 *   description?: string,
 *   location?: string,
 *   occurred_at?: ISO string,
 *   raw?: object
 * }
 */
export const Route = createFileRoute("/api/public/shipping-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-webhook-signature") || "";
        const ip = request.headers.get("x-forwarded-for") || "";

        const secret = process.env.SHIPPING_WEBHOOK_SECRET;
        let signatureValid = false;
        if (secret) {
          try {
            const expected = createHmac("sha256", secret).update(body).digest("hex");
            const sigBuf = Buffer.from(signature);
            const expBuf = Buffer.from(expected);
            if (sigBuf.length === expBuf.length) signatureValid = timingSafeEqual(sigBuf, expBuf);
          } catch {
            signatureValid = false;
          }
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          await supabaseAdmin.from("shipping_webhooks_log").insert({
            carrier_code: "unknown",
            signature,
            signature_valid: false,
            ip_address: ip,
            payload: { raw: body.slice(0, 500) },
            processing_error: "Invalid JSON",
          });
          return new Response("Invalid JSON", { status: 400 });
        }

        const { data: logEntry } = await supabaseAdmin
          .from("shipping_webhooks_log")
          .insert({
            carrier_code: payload.carrier_code || "unknown",
            event_type: payload.event_type,
            signature,
            signature_valid: signatureValid,
            ip_address: ip,
            payload,
          })
          .select()
          .single();

        if (!signatureValid) {
          await supabaseAdmin
            .from("shipping_webhooks_log")
            .update({ processing_error: "Invalid signature" })
            .eq("id", logEntry!.id);
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          if (!payload.tracking_number) {
            await supabaseAdmin
              .from("shipping_webhooks_log")
              .update({ processing_error: "Missing tracking_number" })
              .eq("id", logEntry!.id);
            return new Response("Missing tracking_number", { status: 400 });
          }

          const { data: shipment } = await supabaseAdmin
            .from("shipments")
            .select("id, order_id, status")
            .eq("tracking_number", payload.tracking_number)
            .maybeSingle();

          if (!shipment) {
            await supabaseAdmin
              .from("shipping_webhooks_log")
              .update({ processing_error: "Shipment not found" })
              .eq("id", logEntry!.id);
            return new Response("Shipment not found", { status: 404 });
          }

          const status = mapStatus(payload.status, payload.event_type);

          await supabaseAdmin.from("shipment_tracking_events").insert({
            shipment_id: shipment.id,
            status,
            description: payload.description,
            location: payload.location,
            source: "webhook",
            occurred_at: payload.occurred_at || new Date().toISOString(),
            raw: payload.raw || payload,
          });

          const update: any = { status, updated_at: new Date().toISOString() };
          if (status === "picked_up") update.shipped_at = new Date().toISOString();
          if (status === "delivered") update.delivered_at = new Date().toISOString();
          if (status === "returned") update.is_returned = true;
          if (status === "failed_delivery") update.failure_reason = payload.description || "Failed";
          await supabaseAdmin.from("shipments").update(update).eq("id", shipment.id);

          // Mirror to order
          if (shipment.order_id) {
            const orderMap: Record<string, string> = {
              picked_up: "shipped",
              in_transit: "in_transit",
              out_for_delivery: "out_for_delivery",
              delivered: "delivered",
              failed_delivery: "failed",
              returned: "returned",
              lost: "lost",
            };
            if (orderMap[status]) {
              await supabaseAdmin.from("orders").update({ shipping_status: orderMap[status] }).eq("id", shipment.order_id);
            }
          }

          await supabaseAdmin
            .from("shipping_webhooks_log")
            .update({ processed: true, related_shipment_id: shipment.id })
            .eq("id", logEntry!.id);

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          await supabaseAdmin
            .from("shipping_webhooks_log")
            .update({ processing_error: err?.message || "Unknown error" })
            .eq("id", logEntry!.id);
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});

function mapStatus(status?: string, eventType?: string): string {
  const s = (status || eventType || "").toLowerCase();
  if (s.includes("delivered")) return "delivered";
  if (s.includes("out_for_delivery") || s.includes("out-for-delivery")) return "out_for_delivery";
  if (s.includes("transit")) return "in_transit";
  if (s.includes("picked") || s.includes("pickup")) return "picked_up";
  if (s.includes("fail")) return "failed_delivery";
  if (s.includes("return")) return "returned";
  if (s.includes("lost")) return "lost";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("label") || s.includes("created")) return "label_created";
  return "in_transit";
}
