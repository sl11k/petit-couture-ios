import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  amountsMatch,
  completeGatewayPayment,
  failGatewayPayment,
  loadGatewayOrder,
  logPaymentWebhook,
  refundGatewayPayment,
  updatePaymentWebhookLog,
} from "@/lib/payment-gateway.server";

const TAMARA_API = process.env.TAMARA_API_URL || "https://api.tamara.co";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function verifyNotificationToken(jwt: string, secret: string) {
  try {
    const [headerPart, payloadPart, signaturePart, extra] = jwt.split(".");
    if (!headerPart || !payloadPart || !signaturePart || extra) return null;
    const header = JSON.parse(decodeBase64Url(headerPart).toString("utf8")) as {
      alg?: string;
    };
    if (header.alg !== "HS256") return null;
    const expected = createHmac("sha256", secret).update(`${headerPart}.${payloadPart}`).digest();
    const received = decodeBase64Url(signaturePart);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

    const claims = JSON.parse(decodeBase64Url(payloadPart).toString("utf8")) as {
      exp?: number;
      nbf?: number;
      order_id?: string;
    };
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp !== undefined && claims.exp < now - 30) return null;
    if (claims.nbf !== undefined && claims.nbf > now + 30) return null;
    return claims;
  } catch {
    return null;
  }
}

async function fetchTamaraOrder(orderId: string, token: string) {
  const response = await fetch(`${TAMARA_API}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Tamara order lookup failed (${response.status})`);
  }
  return result as Record<string, unknown>;
}

export const Route = createFileRoute("/api/public/tamara-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const jwt =
          request.headers.get("tamara-token") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          "";
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-real-ip") ||
          request.headers.get("x-forwarded-for") ||
          "";
        const notificationSecret = process.env.TAMARA_NOTIFICATION_TOKEN;
        if (!notificationSecret) {
          console.error("[tamara-webhook] TAMARA_NOTIFICATION_TOKEN is not configured");
          return new Response("Webhook is not configured", { status: 503 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body) as Record<string, unknown>;
        } catch {
          await logPaymentWebhook({
            gateway: "tamara",
            eventType: "invalid_json",
            signature: jwt,
            signatureValid: false,
            ip,
            payload: { raw: body.slice(0, 1000) },
            processingError: "Invalid JSON",
          });
          return new Response("Bad JSON", { status: 400 });
        }

        const claims = verifyNotificationToken(jwt, notificationSecret);
        const eventType = String(payload.event_type || payload.order_status || "").toLowerCase();
        const logId = await logPaymentWebhook({
          gateway: "tamara",
          eventType: eventType || "unknown",
          signature: jwt,
          signatureValid: Boolean(claims),
          ip,
          payload,
        });
        if (!claims) {
          await updatePaymentWebhookLog(logId, { processing_error: "Invalid notification token" });
          return new Response("Invalid notification token", { status: 401 });
        }

        const orderNumber = String(payload.order_reference_id || payload.order_number || "");
        const tamaraOrderId = String(payload.order_id || "");
        if (!orderNumber || !tamaraOrderId) {
          await updatePaymentWebhookLog(logId, { processing_error: "Missing payment identity" });
          return new Response("Missing payment identity", { status: 400 });
        }
        if (claims.order_id && claims.order_id !== tamaraOrderId) {
          await updatePaymentWebhookLog(logId, { processing_error: "Token order mismatch" });
          return new Response("Token order mismatch", { status: 401 });
        }

        try {
          const apiToken = process.env.TAMARA_API_TOKEN;
          if (!apiToken) throw new Error("TAMARA_API_TOKEN is not configured");
          const order = await loadGatewayOrder({ orderNumber, gateway: "tamara" });
          let transactionId: string | null = null;

          if (["order_approved", "approved"].includes(eventType)) {
            const response = await fetch(
              `${TAMARA_API}/orders/${encodeURIComponent(tamaraOrderId)}/authorise`,
              { method: "POST", headers: { Authorization: `Bearer ${apiToken}` } },
            );
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(
                `Tamara authorise failed (${response.status}): ${JSON.stringify(result).slice(0, 300)}`,
              );
            }
          } else if (
            ["order_authorised", "authorised", "order_authorized", "authorized"].includes(eventType)
          ) {
            let capture: unknown = { skipped: "order_already_paid" };
            if (order.payment_status !== "paid") {
              const remote = await fetchTamaraOrder(tamaraOrderId, apiToken);
              const remoteTotal = remote.total_amount as { amount?: unknown; currency?: unknown };
              if (
                !amountsMatch(order.total, remoteTotal?.amount) ||
                String(order.currency).toUpperCase() !== String(remoteTotal?.currency).toUpperCase()
              ) {
                throw new Error("Tamara order amount or currency mismatch");
              }
              const captureResponse = await fetch(`${TAMARA_API}/payments/capture`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiToken}`,
                },
                body: JSON.stringify({
                  order_id: tamaraOrderId,
                  total_amount: remote.total_amount,
                  tax_amount: remote.tax_amount,
                  shipping_amount: remote.shipping_amount,
                  discount_amount: remote.discount_amount,
                  items: remote.items,
                  shipping_info: {
                    shipped_at: new Date().toISOString(),
                    shipping_company: "OTO",
                    tracking_number: "pending",
                    tracking_url: "",
                  },
                }),
              });
              capture = await captureResponse.json().catch(() => ({}));
              if (!captureResponse.ok) {
                throw new Error(
                  `Tamara capture failed (${captureResponse.status}): ${JSON.stringify(capture).slice(0, 300)}`,
                );
              }
            }
            const completed = await completeGatewayPayment({
              order,
              gateway: "tamara",
              gatewayTransactionId: tamaraOrderId,
              rawResponse: { webhook: payload, capture },
            });
            transactionId = completed.transactionId;
          } else if (["order_captured", "fully_captured", "captured"].includes(eventType)) {
            const remote = await fetchTamaraOrder(tamaraOrderId, apiToken);
            const remoteTotal = remote.total_amount as { amount?: unknown; currency?: unknown };
            if (
              !amountsMatch(order.total, remoteTotal?.amount) ||
              String(order.currency).toUpperCase() !== String(remoteTotal?.currency).toUpperCase()
            ) {
              throw new Error("Tamara order amount or currency mismatch");
            }
            const completed = await completeGatewayPayment({
              order,
              gateway: "tamara",
              gatewayTransactionId: tamaraOrderId,
              rawResponse: { webhook: payload, order: remote },
            });
            transactionId = completed.transactionId;
          } else if (
            [
              "order_declined",
              "declined",
              "order_canceled",
              "order_cancelled",
              "canceled",
              "cancelled",
              "order_expired",
              "expired",
            ].includes(eventType)
          ) {
            transactionId = await failGatewayPayment({
              order,
              gateway: "tamara",
              gatewayTransactionId: tamaraOrderId,
              reason: `tamara_${eventType}`,
              rawResponse: payload,
            });
          } else if (["order_refunded", "refunded"].includes(eventType)) {
            const remote = await fetchTamaraOrder(tamaraOrderId, apiToken);
            const remoteTotal = remote.total_amount as { amount?: unknown; currency?: unknown };
            if (
              !amountsMatch(order.total, remoteTotal?.amount) ||
              String(order.currency).toUpperCase() !== String(remoteTotal?.currency).toUpperCase()
            ) {
              throw new Error("Tamara refund amount or currency mismatch");
            }
            transactionId = await refundGatewayPayment({
              order,
              gateway: "tamara",
              gatewayTransactionId: tamaraOrderId,
              rawResponse: { webhook: payload, order: remote },
            });
          } else {
            throw new Error(`Unsupported Tamara event: ${eventType || "empty"}`);
          }

          if (
            [
              "order_authorised",
              "authorised",
              "order_authorized",
              "authorized",
              "order_captured",
              "fully_captured",
              "captured",
            ].includes(eventType)
          ) {
            const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
            const shipment = await createOtoShipmentForOrder(order.id, null);
            if (!shipment.ok) throw new Error(`OTO creation failed: ${shipment.error}`);
          }

          await updatePaymentWebhookLog(logId, {
            processed: true,
            related_transaction_id: transactionId,
          });
          return Response.json({ received: true, event: eventType });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Processing failed";
          await updatePaymentWebhookLog(logId, { processing_error: message });
          console.error("[tamara-webhook]", message);
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
