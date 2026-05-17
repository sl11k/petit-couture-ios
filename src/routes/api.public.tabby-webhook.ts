// Tabby webhook handler — receives payment.* events from Tabby and updates orders.
// Docs: https://docs.tabby.ai/reference/webhooks
//
// Tabby signs webhooks with header `X-Hook-Signature` = HMAC-SHA256(body, secret) hex.
// The secret is configured per-merchant in Tabby dashboard.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/tabby-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-hook-signature") || "";
        const secret = process.env.TABBY_WEBHOOK_SECRET || process.env.TABBY_SECRET_KEY;

        // Verify signature when secret is set
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
          return new Response("Bad JSON", { status: 400 });
        }

        // Log for audit
        await (supabaseAdmin.from("payment_webhooks_log") as any).insert({
          gateway: "tabby",
          event_type: payload?.status || "unknown",
          order_number: payload?.order?.reference_id || null,
          transaction_id: payload?.id || null,
          signature_valid: signatureValid,
          payload,
        }).then(() => {}, () => {});

        if (!signatureValid && secret) {
          return new Response("Invalid signature", { status: 401 });
        }

        const orderNumber = payload?.order?.reference_id;
        const tabbyStatus = String(payload?.status || "").toLowerCase();
        const paymentId = payload?.id;

        if (!orderNumber || !paymentId) {
          return Response.json({ received: true, ignored: "missing fields" });
        }

        // Map Tabby status → our payment_status
        // authorized → pending capture; we auto-capture below
        // closed → captured (paid)
        // rejected/expired → failed
        let newPaymentStatus: string | null = null;
        let newOrderStatus: string | null = null;

        if (tabbyStatus === "authorized") {
          // Auto-capture
          try {
            const capRes = await fetch(
              `https://api.tabby.ai/api/v1/payments/${paymentId}/captures`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.TABBY_SECRET_KEY}`,
                },
                body: JSON.stringify({ amount: payload.amount }),
              },
            );
            if (capRes.ok) {
              newPaymentStatus = "paid";
              newOrderStatus = "processing";
            } else {
              newPaymentStatus = "pending_review";
            }
          } catch (e) {
            console.error("Tabby capture error", e);
            newPaymentStatus = "pending_review";
          }
        } else if (tabbyStatus === "closed") {
          newPaymentStatus = "paid";
          newOrderStatus = "processing";
        } else if (tabbyStatus === "rejected" || tabbyStatus === "expired") {
          newPaymentStatus = "failed";
        } else if (tabbyStatus === "refunded") {
          newPaymentStatus = "refunded";
        }

        if (newPaymentStatus) {
          const update: Record<string, unknown> = {
            payment_status: newPaymentStatus,
            updated_at: new Date().toISOString(),
          };
          if (newOrderStatus) update.status = newOrderStatus;
          if (newPaymentStatus === "failed") {
            update.payment_failure_reason = payload?.rejection_reason || "tabby_rejected";
          }
          await (supabaseAdmin.from("orders") as any)
            .update(update)
            .eq("order_number", orderNumber);
        }

        return Response.json({ received: true, status: tabbyStatus });
      },
    },
  },
});
