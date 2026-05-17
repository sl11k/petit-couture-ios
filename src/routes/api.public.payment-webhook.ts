import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Public payment webhook endpoint.
 * 
 * Security:
 * - HMAC-SHA256 signature verification using PAYMENT_WEBHOOK_SECRET
 * - All requests logged (verified or not) for audit
 * - Idempotency: Transaction updates are based on gateway_transaction_id
 * 
 * Expected payload (gateway-agnostic):
 * {
 *   gateway: "stripe" | "tap" | "moyasar" | "tabby" | "tamara",
 *   event_type: "payment.succeeded" | "payment.failed" | "refund.completed",
 *   transaction_id: "<gateway txn id>",
 *   order_number: "MN-...",
 *   amount: 123.45,
 *   currency: "SAR",
 *   status: "captured" | "failed" | "refunded",
 *   error_code?: string,
 *   error_message?: string,
 *   gateway_fee?: number,
 *   card_last4?: string,
 *   card_brand?: string,
 *   raw?: object
 * }
 * 
 * Header: X-Webhook-Signature = HMAC-SHA256(body, PAYMENT_WEBHOOK_SECRET) hex
 */
export const Route = createFileRoute("/api/public/payment-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-webhook-signature") || "";
        const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";

        const secret = process.env.PAYMENT_WEBHOOK_SECRET;
        let signatureValid = false;
        if (secret) {
          try {
            const expected = createHmac("sha256", secret).update(body).digest("hex");
            const sigBuf = Buffer.from(signature);
            const expBuf = Buffer.from(expected);
            if (sigBuf.length === expBuf.length) {
              signatureValid = timingSafeEqual(sigBuf, expBuf);
            }
          } catch {
            signatureValid = false;
          }
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          await supabaseAdmin.from("payment_webhooks_log").insert({
            gateway: "unknown",
            signature,
            signature_valid: false,
            ip_address: ip,
            payload: { raw: body.slice(0, 500) },
            processing_error: "Invalid JSON",
          });
          return new Response("Invalid JSON", { status: 400 });
        }

        // Always log the attempt (even invalid signatures - for security audit)
        const { data: logEntry } = await supabaseAdmin
          .from("payment_webhooks_log")
          .insert({
            gateway: payload.gateway || "unknown",
            event_type: payload.event_type,
            signature,
            signature_valid: signatureValid,
            ip_address: ip,
            payload,
          })
          .select()
          .single();

        if (!signatureValid) {
          if (logEntry) {
            await supabaseAdmin
              .from("payment_webhooks_log")
              .update({ processing_error: "Invalid signature" })
              .eq("id", logEntry.id);
          }
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          // Find transaction by gateway_transaction_id OR order_number
          let txnId: string | null = null;
          let orderId: string | null = null;

          if (payload.transaction_id) {
            const { data: existing } = await supabaseAdmin
              .from("payment_transactions")
              .select("id, order_id")
              .eq("gateway_transaction_id", payload.transaction_id)
              .maybeSingle();
            if (existing) {
              txnId = existing.id;
              orderId = existing.order_id;
            }
          }

          if (!txnId && payload.order_number) {
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("id")
              .eq("order_number", payload.order_number)
              .maybeSingle();
            if (order) {
              orderId = order.id;
              // Create transaction record
              const { data: newTxn } = await supabaseAdmin
                .from("payment_transactions")
                .insert({
                  order_id: order.id,
                  order_number: payload.order_number,
                  amount: payload.amount,
                  currency: payload.currency || "SAR",
                  gateway: payload.gateway,
                  gateway_transaction_id: payload.transaction_id,
                  status: "pending",
                  webhook_verified: true,
                })
                .select()
                .single();
              if (newTxn) txnId = newTxn.id;
            }
          }

          if (!txnId) {
            await supabaseAdmin
              .from("payment_webhooks_log")
              .update({ processing_error: "Transaction or order not found" })
              .eq("id", logEntry!.id);
            return new Response("Transaction not found", { status: 404 });
          }

          // Validate amount matches (security check)
          if (payload.amount && orderId) {
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("total")
              .eq("id", orderId)
              .single();
            if (order && Math.abs(Number(order.total) - Number(payload.amount)) > 0.01) {
              await supabaseAdmin
                .from("payment_webhooks_log")
                .update({ processing_error: "Amount mismatch" })
                .eq("id", logEntry!.id);
              return new Response("Amount mismatch", { status: 400 });
            }
          }

          // Update transaction
          const status = mapStatus(payload.status, payload.event_type);
          const update: any = {
            status,
            webhook_verified: true,
            updated_at: new Date().toISOString(),
            raw_response: payload.raw || payload,
          };
          if (payload.error_code) update.error_code = payload.error_code;
          if (payload.error_message) update.error_message = payload.error_message;
          if (payload.gateway_fee !== undefined) {
            update.gateway_fee = payload.gateway_fee;
            update.net_amount = Number(payload.amount) - Number(payload.gateway_fee);
          }
          if (payload.card_last4) update.card_last4 = payload.card_last4;
          if (payload.card_brand) update.card_brand = payload.card_brand;
          if (status === "captured" || status === "paid") update.captured_at = new Date().toISOString();
          if (status === "failed") update.failed_at = new Date().toISOString();
          if (status === "authorized") update.authorized_at = new Date().toISOString();

          await supabaseAdmin.from("payment_transactions").update(update).eq("id", txnId);

          // Update order status
          if (orderId && (status === "captured" || status === "paid")) {
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: "paid",
                status: "confirmed",
                payment_gateway: payload.gateway,
                last_transaction_id: txnId,
                captured_amount: payload.amount,
              })
              .eq("id", orderId);
          } else if (orderId && status === "failed") {
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: "failed",
                payment_failure_reason: payload.error_message || "Payment failed",
                last_payment_attempt_at: new Date().toISOString(),
              })
              .eq("id", orderId);
          }

          await supabaseAdmin
            .from("payment_webhooks_log")
            .update({ processed: true, related_transaction_id: txnId })
            .eq("id", logEntry!.id);

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          await supabaseAdmin
            .from("payment_webhooks_log")
            .update({ processing_error: err?.message || "Unknown error" })
            .eq("id", logEntry!.id);
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});

function mapStatus(status?: string, eventType?: string): string {
  const s = (status || "").toLowerCase();
  const e = (eventType || "").toLowerCase();
  if (s === "captured" || s === "paid" || s === "succeeded" || e.includes("succeeded")) return "captured";
  if (s === "authorized" || s === "approved") return "authorized";
  if (s === "failed" || s === "declined" || e.includes("failed")) return "failed";
  if (s === "refunded" || e.includes("refund")) return "refunded";
  if (s === "voided" || s === "cancelled") return "voided";
  if (s === "expired") return "expired";
  return "pending";
}
