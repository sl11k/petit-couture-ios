import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "low_stock_products",
  title: "Low stock products",
  description: "List active products whose available stock is at or below a threshold, so they can be restocked.",
  inputSchema: {
    threshold: z.number().int().min(0).max(1000).default(5).describe("Available stock at or below this value."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ threshold, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, sku, name_ar, name_en, stock, reserved_stock, low_stock_threshold, price, currency")
      .eq("is_active", true)
      .lte("stock", threshold)
      .order("stock", { ascending: true })
      .limit(limit);
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
