import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_product",
  title: "Get product",
  description: "Fetch a single product by id or slug, including its variants.",
  inputSchema: {
    id_or_slug: z.string().trim().min(1).describe("Product UUID or URL slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id_or_slug }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id_or_slug);
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq(isUuid ? "id" : "slug", id_or_slug)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!product) return errorResult(`Product not found: ${id_or_slug}`);
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", (product as { id: string }).id);
    return jsonResult({ product, variants: variants ?? [] });
  },
});
