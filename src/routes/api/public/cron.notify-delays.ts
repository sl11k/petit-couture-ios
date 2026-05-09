import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/notify-delays")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin.rpc("notify_shipping_delays", {
          _pending_threshold_hours: 48,
          _intransit_threshold_days: 7,
        });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.json({ ok: true, results: data });
      },
    },
  },
});
