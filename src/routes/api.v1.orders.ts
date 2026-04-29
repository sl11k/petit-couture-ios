import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withApi, jsonOk, jsonError, paging } from "@/server/apiAuth.server";

export const Route = createFileRoute("/api/v1/orders")({
  server: {
    handlers: {
      GET: withApi("orders:read", async ({ url }) => {
        const { from, to, page, pageSize } = paging(url);
        const status = url.searchParams.get("status");
        let q = supabaseAdmin
          .from("orders")
          .select(
            "id,order_number,status,payment_status,total,currency,customer_id,created_at",
            { count: "exact" },
          )
          .order("created_at", { ascending: false })
          .range(from, to);
        if (status) q = q.eq("status", status);
        const { data, count, error } = await q;
        if (error) return jsonError(500, "db_error", error.message);
        return jsonOk({ items: data ?? [], page, page_size: pageSize, total: count ?? 0 });
      }),
    },
  },
});
