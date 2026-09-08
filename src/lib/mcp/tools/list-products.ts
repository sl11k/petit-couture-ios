import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "Search and list store products with price, stock and status. Supports text search on name or SKU.",
  inputSchema: {
    query: z.string().trim().optional().describe("Search text matched against Arabic/English name, slug or SKU."),
    active_only: z.boolean().default(true).describe("Only return active products."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, active_only, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("products")
      .select("id, slug, sku, name_ar, name_en, price, compare_at_price, currency, stock, reserved_stock, is_active, status, category_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (active_only) q = q.eq("is_active", true);
    if (query) {
      const safe = query.replace(/[%,()]/g, " ");
      q = q.or(`name_ar.ilike.%${safe}%,name_en.ilike.%${safe}%,slug.ilike.%${safe}%,sku.ilike.%${safe}%`);
    }
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
