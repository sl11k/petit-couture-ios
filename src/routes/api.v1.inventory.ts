import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withApi, jsonOk, jsonError } from "@/server/apiAuth.server";

export const Route = createFileRoute("/api/v1/inventory")({
  server: {
    handlers: {
      // PATCH stock for a product
      POST: withApi("inventory:write", async ({ request }) => {
        const body = await request.json().catch(() => null);
        if (!body?.product_id || typeof body.stock !== "number") {
          return jsonError(400, "bad_request", "product_id and stock are required");
        }
        if (body.stock < 0 || body.stock > 1_000_000) {
          return jsonError(400, "bad_request", "stock must be 0..1_000_000");
        }
        const { error } = await supabaseAdmin
          .from("products")
          .update({ stock: body.stock })
          .eq("id", body.product_id);
        if (error) return jsonError(500, "db_error", error.message);
        return jsonOk({ product_id: body.product_id, stock: body.stock });
      }),
    },
  },
});
