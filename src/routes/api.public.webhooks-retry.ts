/**
 * Cron-callable endpoint to retry pending webhook deliveries.
 * Schedule via pg_cron or external scheduler:
 *   GET /api/public/webhooks-retry
 *   Header: x-cron-key: <secret>
 *
 * Set WEBHOOK_CRON_SECRET in lppme Cloud secrets.
 */
import { createFileRoute } from "@tanstack/react-router";
import { processRetries } from "@/server/webhooks.server";

export const Route = createFileRoute("/api/public/webhooks-retry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.WEBHOOK_CRON_SECRET;
        const provided = request.headers.get("x-cron-key");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await processRetries(100);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
