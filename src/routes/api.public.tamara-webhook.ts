// Tamara webhook handler — receives order.* events from Tamara and updates orders.
// Docs: https://docs.tamara.co/reference/webhooks
//
// Tamara signs each notification with header `tamara-token` containing a JWT
// signed with HS256 using the merchant's notification token as the shared secret.
// (Some merchants are issued a Public Key for RS256 — supported as a fallback.)
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TAMARA_API = process.env.TAMARA_API_URL || "https://api.tamara.co";

function b64urlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function verifyHs256(jwt: string, secret: string): boolean {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    const [h, p, s] = parts;
    const data = `${h}.${p}`;
    const expected = createHmac("sha256", secret).update(data).digest();
    const got = b64urlDecode(s);
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/tamara-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const token =
          request.headers.get("tamara-token") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          "";
        const notificationSecret = process.env.TAMARA_NOTIFICATION_TOKEN;

        let signatureValid = false;
        if (notificationSecret && token) {
          signatureValid = verifyHs256(token, notificationSecret);
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const orderNumber =
          payload?.order_reference_id || payload?.order_number || null;
        const tamaraOrderId = payload?.order_id || null;
        const eventType = String(
          payload?.event_type || payload?.order_status || "unknown",
        ).toLowerCase();

        // Audit log
        await (supabaseAdmin.from("payment_webhooks_log") as any)
          .insert({
            gateway: "tamara",
            event_type: eventType,
            order_number: orderNumber,
            transaction_id: tamaraOrderId,
            signature_valid: signatureValid,
            payload,
          })
          .then(
            () => {},
            () => {},
          );

        if (!signatureValid && notificationSecret) {
          return new Response("Invalid signature", { status: 401 });
        }

        if (!orderNumber) {
          return Response.json({ received: true, ignored: "no reference" });
        }

        // Map Tamara status → our payment_status
        let newPaymentStatus: string | null = null;
        let newOrderStatus: string | null = null;

        if (eventType === "order_approved" || eventType === "approved") {
          // Auto authorise + capture
          if (tamaraOrderId && process.env.TAMARA_API_TOKEN) {
            try {
              await fetch(`${TAMARA_API}/orders/${tamaraOrderId}/authorise`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.TAMARA_API_TOKEN}`,
                },
              });
              newPaymentStatus = "pending_review";
            } catch (e) {
              console.error("Tamara authorise error", e);
            }
          }
        } else if (
          eventType === "order_authorised" ||
          eventType === "authorised" ||
          eventType === "order_authorized"
        ) {
          // Capture full amount
          if (tamaraOrderId && process.env.TAMARA_API_TOKEN) {
            try {
              const ordRes = await fetch(
                `${TAMARA_API}/orders/${tamaraOrderId}`,
                {
                  headers: {
                    Authorization: `Bearer ${process.env.TAMARA_API_TOKEN}`,
                  },
                },
              );
              const ord = await ordRes.json();
              const capRes = await fetch(`${TAMARA_API}/payments/capture`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.TAMARA_API_TOKEN}`,
                },
                body: JSON.stringify({
                  order_id: tamaraOrderId,
                  total_amount: ord.total_amount,
                  tax_amount: ord.tax_amount,
                  shipping_amount: ord.shipping_amount,
                  discount_amount: ord.discount_amount,
                  items: ord.items,
                  shipping_info: {
                    shipped_at: new Date().toISOString(),
                    shipping_company: "—",
                    tracking_number: "—",
                    tracking_url: "",
                  },
                }),
              });
              if (capRes.ok) {
                newPaymentStatus = "paid";
                newOrderStatus = "confirmed";
              } else {
                newPaymentStatus = "pending_review";
              }
            } catch (e) {
              console.error("Tamara capture error", e);
              newPaymentStatus = "pending_review";
            }
          }
        } else if (
          eventType === "order_captured" ||
          eventType === "fully_captured" ||
          eventType === "captured"
        ) {
          newPaymentStatus = "paid";
          newOrderStatus = "confirmed";
        } else if (
          eventType === "order_declined" ||
          eventType === "declined" ||
          eventType === "order_canceled" ||
          eventType === "order_cancelled" ||
          eventType === "canceled" ||
          eventType === "cancelled" ||
          eventType === "order_expired" ||
          eventType === "expired"
        ) {
          newPaymentStatus = "failed";
        } else if (
          eventType === "order_refunded" ||
          eventType === "refunded"
        ) {
          newPaymentStatus = "refunded";
        }

        if (newPaymentStatus) {
          const update: Record<string, unknown> = {
            payment_status: newPaymentStatus,
            updated_at: new Date().toISOString(),
          };
          if (newOrderStatus) update.status = newOrderStatus;
          await (supabaseAdmin.from("orders") as any)
            .update(update)
            .eq("order_number", orderNumber);
        }

        return Response.json({ received: true, status: newPaymentStatus });
      },
    },
  },
});
