import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import {
  amountsMatch,
  completeGatewayPayment,
  failGatewayPayment,
  loadGatewayOrder,
  logPaymentWebhook,
  money,
  refundGatewayPayment,
  updatePaymentWebhookLog,
} from "@/lib/payment-gateway.server";
import { convertPegged } from "@/lib/tabby-currency";
import { listTabbyAccounts, tabbyAccountsForOrder } from "@/lib/tabby-accounts.server";

/**
 * Every configured Tabby account (KSA + UAE) registers its own webhook, so a
 * request is authentic when its static signature matches ANY of them.
 */
async function webhookSecrets() {
  const accounts = await listTabbyAccounts();
  const secrets = accounts.map((a) => a.webhookSecret || "").filter(Boolean);
  const globals = [
    String(process.env.TABBY_WEBHOOK_SECRET || "").trim(),
    String(process.env.TABBY_SA_WEBHOOK_SECRET || "").trim(),
    String(process.env.TABBY_AE_WEBHOOK_SECRET || "").trim(),
    String(process.env.PAYMENT_WEBHOOK_SECRET || "").trim(),
  ].filter(Boolean);
  return Array.from(new Set([...secrets, ...globals]));
}

function matches(signature: string, secret: string) {
  try {
    const received = Buffer.from(signature, "utf8");
    const wanted = Buffer.from(secret, "utf8");
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
        // Tabby echoes the static x-hook-signature value configured when the
        // webhook is registered; it is not an HMAC of the request body.
        const secrets = await webhookSecrets();
        if (!secrets.length) {
          console.error("[tabby-webhook] no Tabby secret configured");
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

        const signatureValid = secrets.some((s) => matches(signature, s));
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
          // The Tabby merchant account settles in its own currency (AED), while
          // the order is stored in the store currency (SAR). Validate the amount
          // after converting with the same fixed peg used at checkout.
          const order = await loadGatewayOrder({ orderNumber, gateway: "tabby" });
          const settlementCurrency = String(payload.currency || order.currency).toUpperCase();
          const expectedAmount = convertPegged(
            money(order.total),
            String(order.currency).toUpperCase(),
            settlementCurrency,
          );
          if (payload.amount !== undefined && !amountsMatch(expectedAmount, payload.amount)) {
            throw new Error("Payment amount mismatch");
          }
          let transactionId: string | null = null;

          if (status === "authorized") {
            let capture: unknown = { skipped: "order_already_paid" };
            if (order.payment_status !== "paid") {
              // Capture with the account that actually owns this payment
              // (KSA and UAE merchants have separate secret keys), falling back
              // to the other account when the first one rejects the credentials.
              const candidates = await tabbyAccountsForOrder(order);
              if (!candidates.length) throw new Error("No Tabby account is configured");
              let captureResponse: Response | null = null;
              for (const candidate of candidates) {
                captureResponse = await fetch(
                  `https://api.tabby.ai/api/v1/payments/${encodeURIComponent(paymentId)}/captures`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${candidate.secret}`,
                    },
                    body: JSON.stringify({ amount: expectedAmount.toFixed(2) }),
                  },
                );
                capture = await captureResponse.json().catch(() => ({}));
                if (captureResponse.ok || ![401, 403, 404].includes(captureResponse.status)) break;
              }

              if (!captureResponse || !captureResponse.ok) {
                throw new Error(
                  `Tabby capture failed (${captureResponse?.status ?? 0}): ${JSON.stringify(capture).slice(0, 300)}`,
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
