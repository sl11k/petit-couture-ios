import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractMetaStatuses, verifyMetaSignature } from "@/lib/notif/meta-webhook.server";

export const Route = createFileRoute("/api/public/meta-whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("hub.verify_token") || "";
        const challenge = url.searchParams.get("hub.challenge") || "";
        const mode = url.searchParams.get("hub.mode");
        const expected = process.env.WHATSAPP_META_VERIFY_TOKEN || "";
        if (mode === "subscribe" && expected && token === expected) return new Response(challenge, { status: 200 });
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256") || "";
        const secret = process.env.WHATSAPP_META_APP_SECRET || "";
        const valid = verifyMetaSignature(rawBody, signature, secret);
        if (!valid) return new Response("Invalid signature", { status: 401 });
        let payload: unknown;
        try { payload = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }
        const statuses = extractMetaStatuses(payload);
        for (const status of statuses) {
          const { error } = await (supabaseAdmin.rpc as any)("apply_whatsapp_provider_status", {
            _event_key: status.eventKey,
            _provider_code: "meta_cloud",
            _provider_message_id: status.messageId,
            _status: status.status,
            _provider_timestamp: status.timestamp,
            _signature_valid: true,
            _sanitized_payload: status.sanitized,
            _error_code: status.errorCode ?? null,
            _error_message: status.errorMessage ?? null,
          });
          if (error) console.error("[meta-whatsapp-webhook] status persistence failed", { code: error.code, message: error.message });
        }
        return Response.json({ received: true, statuses: statuses.length });
      },
    },
  },
});
