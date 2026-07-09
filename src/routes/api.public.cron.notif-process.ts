// Cron endpoint: processes the notification queue.
// Called by pg_cron every minute. Auth: Supabase anon apikey header.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/notif-process")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { processQueueBatch, runProviderHealthCheck } = await import(
            "@/lib/notif/engine.server"
          );
          const result = await processQueueBatch(50);
          // Health-check once every ~10 minutes (approx via random gate)
          if (Math.random() < 0.1) {
            try { await runProviderHealthCheck(); } catch { /* ignore */ }
          }
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ ok: false, error: err?.message || "processing failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        return new Response(JSON.stringify({ ok: true, hint: "POST to process queue" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
