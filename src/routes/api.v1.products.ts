import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withApi, jsonOk, jsonError, paging } from "@/server/apiAuth.server";

export const Route = createFileRoute("/api/v1/products")({
  server: {
    handlers: {
      GET: withApi("products:read", async ({ url }) => {
        const { from, to, page, pageSize } = paging(url);
        const { data, count, error } = await supabaseAdmin
          .from("products")
          .select(
            "id,sku,name_ar,name_en,brand,price,stock,is_active,image_url,category_id,created_at",
            { count: "exact" },
          )
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) return jsonError(500, "db_error", error.message);
        return jsonOk({ items: data ?? [], page, page_size: pageSize, total: count ?? 0 });
      }),
    },
  },
});
