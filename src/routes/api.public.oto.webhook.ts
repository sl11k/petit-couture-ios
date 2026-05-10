// Public OTO inbound webhook endpoint.
// OTO POSTs orderStatus / shipmentError / newOrders payloads here after
// we register this URL via POST /rest/v2/webhook.
//
// Security: see src/lib/oto-webhook.ts. OTO embeds the signature in the JSON
// body, NOT in an X-Webhook-Signature header. Optional Authorization header
// check uses OTO_WEBHOOK_AUTHORIZATION_KEY.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  normalizeOtoPayload,
  verifyOtoWebhookSignature,
  mapOtoStatus,
} from "@/lib/oto-webhook";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/oto/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for") ||
          request.headers.get("cf-connecting-ip") ||
          "";
        const rawText = await request.text();

        let json: Record<string, unknown>;
        try {
          json = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
        } catch {
          await supabaseAdmin.from("oto_webhook_deliveries").insert(({
            webhook_type: "unknown",
            raw: { _invalid_json: rawText.slice(0, 1000) },
            processing_error: "Invalid JSON",
            http_status: 400,
            ip_address: ip,
          });
          return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
        }

        const normalized = normalizeOtoPayload(json);

        // Optional authorization header check.
        const authKey = process.env.OTO_WEBHOOK_AUTHORIZATION_KEY;
        const authHeader = request.headers.get("authorization") || "";
        const authPresent = authHeader.length > 0;
        const authValid = authKey ? authHeader === authKey || authHeader === `Bearer ${authKey}` : true;

        // Optional in-body signature check.
        const secretKey = process.env.OTO_WEBHOOK_SECRET_KEY;
        const allowUnsigned = process.env.OTO_ALLOW_UNSIGNED === "1";
        const signaturePresent = Boolean((normalized as { signature?: string }).signature);
        const signatureValid = secretKey
          ? verifyOtoWebhookSignature(normalized, secretKey)
          : true;

        const baseLog = {
          webhook_type: normalized.kind,
          order_id: (normalized as { orderId?: string }).orderId ?? null,
          tracking_number: (normalized as { trackingNumber?: string }).trackingNumber ?? null,
          status_value: (normalized as { status?: string }).status ?? null,
          error_code: (normalized as { errorCode?: string }).errorCode ?? null,
          raw: json,
          signature_present: signaturePresent,
          signature_valid: signatureValid,
          auth_present: authPresent,
          auth_valid: authValid,
          ip_address: ip,
        } as const;

        // Reject when configured and check fails (production-safe default).
        if (authKey && !authValid) {
          await supabaseAdmin.from("oto_webhook_deliveries").insert(({
            ...baseLog,
            processing_error: "Invalid authorization key",
            http_status: 401,
          });
          return jsonResponse({ ok: false, error: "Invalid authorization key" }, 401);
        }

        if (secretKey && !signatureValid && !allowUnsigned) {
          await supabaseAdmin.from("oto_webhook_deliveries").insert(({
            ...baseLog,
            processing_error: signaturePresent
              ? "Signature mismatch"
              : "Missing signature",
            http_status: 401,
          });
          return jsonResponse(
            { ok: false, error: "Invalid or missing signature" },
            401,
          );
        }

        if (normalized.kind === "unknown") {
          await supabaseAdmin.from("oto_webhook_deliveries").insert(({
            ...baseLog,
            processing_error: "Unknown OTO payload shape",
            http_status: 400,
          });
          return jsonResponse({ ok: false, error: "Unknown payload" }, 400);
        }

        // Process: locate shipment + update status.
        let processingError: string | null = null;
        try {
          const orderId = (normalized as { orderId?: string }).orderId;
          if (!orderId) throw new Error("Missing orderId");

          // Find shipment by tracking number (preferred) or by OTO order id we previously stored.
          const tracking =
            (normalized as { trackingNumber?: string }).trackingNumber ||
            (normalized as { dcTrackingNumber?: string }).dcTrackingNumber ||
            null;

          let shipmentId: string | null = null;
          let dbOrderId: string | null = null;
          if (tracking) {
            const { data } = await supabaseAdmin
              .from("shipments")
              .select("id, order_id")
              .eq("tracking_number", tracking)
              .maybeSingle();
            if (data) {
              shipmentId = data.id;
              dbOrderId = data.order_id;
            }
          }
          if (!shipmentId) {
            // Fallback: shipment.raw_response.orderId == OTO orderId, or order_number match.
            const { data } = await supabaseAdmin
              .from("shipments")
              .select("id, order_id")
              .eq("carrier_code", "oto")
              .or(`order_number.eq.${orderId}`)
              .limit(1)
              .maybeSingle();
            if (data) {
              shipmentId = data.id;
              dbOrderId = data.order_id;
            }
          }

          if (normalized.kind === "orderStatus") {
            const internal = mapOtoStatus(normalized.status);
            if (shipmentId) {
              const update: Record<string, unknown> = {
                status: internal === "unknown" ? "in_transit" : internal,
                updated_at: new Date().toISOString(),
                raw_response: normalized.raw,
              };
              if (internal === "picked_up") update.shipped_at = new Date().toISOString();
              if (internal === "delivered") update.delivered_at = new Date().toISOString();
              if (internal === "returned") update.is_returned = true;
              if (normalized.trackingUrl) update.tracking_url = normalized.trackingUrl;
              if (normalized.printAWBURL) update.awb_url = normalized.printAWBURL;
              await supabaseAdmin.from("shipments").update(update as never).eq("id", shipmentId);

              await supabaseAdmin.from("shipment_tracking_events").insert(({
                shipment_id: shipmentId,
                status: internal,
                description: normalized.note ?? normalized.dcStatus ?? null,
                source: "webhook",
                occurred_at: normalized.timestamp,
                raw: normalized.raw,
              });

              if (dbOrderId) {
                const orderMap: Record<string, string> = {
                  picked_up: "shipped",
                  in_transit: "in_transit",
                  out_for_delivery: "out_for_delivery",
                  delivered: "delivered",
                  returned: "returned",
                  failed: "failed",
                  cancelled: "cancelled",
                };
                const mapped = orderMap[internal];
                if (mapped) {
                  await supabaseAdmin
                    .from("orders")
                    .update({ shipping_status: mapped })
                    .eq("id", dbOrderId);
                }
              }
            }
          } else if (normalized.kind === "shipmentError") {
            if (shipmentId) {
              await supabaseAdmin
                .from("shipments")
                .update({
                  status: "failed",
                  failure_reason:
                    normalized.errorMessage || normalized.errorCode || "Shipment error",
                  raw_response: normalized.raw,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", shipmentId);
              await supabaseAdmin.from("shipment_tracking_events").insert(({
                shipment_id: shipmentId,
                status: "failed",
                description:
                  normalized.errorMessage ||
                  normalized.deliveryCompanyResponse ||
                  normalized.errorCode,
                source: "webhook",
                occurred_at: normalized.timestamp,
                raw: normalized.raw,
              });
            }
          }
        } catch (e) {
          processingError = e instanceof Error ? e.message : "Processing failed";
        }

        await supabaseAdmin.from("oto_webhook_deliveries").insert(({
          ...baseLog,
          processed: !processingError,
          processing_error: processingError,
          http_status: 200,
        });

        return jsonResponse({
          ok: true,
          provider: "oto",
          eventType: normalized.kind,
          orderId: (normalized as { orderId?: string }).orderId ?? null,
          trackingNumber: (normalized as { trackingNumber?: string }).trackingNumber ?? null,
        });
      },
    },
  },
});
