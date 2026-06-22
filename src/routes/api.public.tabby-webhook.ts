import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  completeGatewayPayment,
  failGatewayPayment,
  loadGatewayOrder,
  logPaymentWebhook,
  refundGatewayPayment,
  updatePaymentWebhookLog,
} from "@/lib/payment-gateway.server";

function validSignature(body: string, signature: string, secret: string) {
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const received = Buffer.from(signature, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    return received.length === wanted.length && timingSafeEqual(received, wanted);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/tabby-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-hook-signature") || "";
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-real-ip") ||
          request.headers.get("x-forwarded-for") ||
          "";
        const secret = process.env.TABBY_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[tabby-webhook] TABBY_WEBHOOK_SECRET is not configured");
          return new Response("Webhook is not configured", { status: 503 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body) as Record<string, unknown>;
        } catch {
          await logPaymentWebhook({
            gateway: "tabby",
            eventType: "invalid_json",
            signature,
            signatureValid: false,
            ip,
            payload: { raw: body.slice(0, 1000) },
            processingError: "Invalid JSON",
          });
          return new Response("Bad JSON", { status: 400 });
        }

        const signatureValid = validSignature(body, signature, secret);
        const status = String(payload.status || "").toLowerCase();
        const logId = await logPaymentWebhook({
          gateway: "tabby",
          eventType: status || "unknown",
          signature,
          signatureValid,
          ip,
          payload,
        });
        if (!signatureValid) {
          await updatePaymentWebhookLog(logId, { processing_error: "Invalid signature" });
          return new Response("Invalid signature", { status: 401 });
        }

        const providerOrder = payload.order as Record<string, unknown> | undefined;
        const orderNumber = String(providerOrder?.reference_id || "");
        const paymentId = String(payload.id || "");
        if (!orderNumber || !paymentId) {
          await updatePaymentWebhookLog(logId, { processing_error: "Missing payment identity" });
          return new Response("Missing payment identity", { status: 400 });
        }

        try {
          const order = await loadGatewayOrder({
            orderNumber,
            gateway: "tabby",
            amount: payload.amount,
            currency: payload.currency,
          });
          let transactionId: string | null = null;

          if (status === "authorized") {
            let capture: unknown = { skipped: "order_already_paid" };
            if (order.payment_status !== "paid") {
              const apiKey = process.env.TABBY_SECRET_KEY;
              if (!apiKey) throw new Error("TABBY_SECRET_KEY is not configured");
              const captureResponse = await fetch(
                `https://api.tabby.ai/api/v1/payments/${encodeURIComponent(paymentId)}/captures`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({ amount: Number(order.total).toFixed(2) }),
                },
              );
              capture = await captureResponse.json().catch(() => ({}));
              if (!captureResponse.ok) {
                throw new Error(
                  `Tabby capture failed (${captureResponse.status}): ${JSON.stringify(capture).slice(0, 300)}`,
                );
              }
            }
            const completed = await completeGatewayPayment({
              order,
              gateway: "tabby",
              gatewayTransactionId: paymentId,
              rawResponse: { webhook: payload, capture },
            });
            transactionId = completed.transactionId;
          } else if (status === "closed") {
            const completed = await completeGatewayPayment({
              order,
              gateway: "tabby",
              gatewayTransactionId: paymentId,
              rawResponse: payload,
            });
            transactionId = completed.transactionId;
          } else if (["rejected", "expired"].includes(status)) {
            transactionId = await failGatewayPayment({
              order,
              gateway: "tabby",
              gatewayTransactionId: paymentId,
              reason: String(payload.rejection_reason || `tabby_${status}`),
              rawResponse: payload,
            });
          } else if (status === "refunded") {
            transactionId = await refundGatewayPayment({
              order,
              gateway: "tabby",
              gatewayTransactionId: paymentId,
              rawResponse: payload,
            });
          } else if (status !== "created") {
            throw new Error(`Unsupported Tabby status: ${status || "empty"}`);
          }

          if (["authorized", "closed"].includes(status)) {
            const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
            const shipment = await createOtoShipmentForOrder(order.id, null);
            if (!shipment.ok) throw new Error(`OTO creation failed: ${shipment.error}`);
          }

          await updatePaymentWebhookLog(logId, {
            processed: true,
            related_transaction_id: transactionId,
          });
          return Response.json({ received: true, status });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Processing failed";
          await updatePaymentWebhookLog(logId, { processing_error: message });
          console.error("[tabby-webhook]", message);
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
