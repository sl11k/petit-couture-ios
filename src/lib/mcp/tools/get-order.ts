import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_order",
  title: "Get order",
  description: "Fetch one order by order number (e.g. MN-260824-8339) or UUID, with its line items and shipping details.",
  inputSchema: {
    order: z.string().trim().min(1).describe("Order number or order UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order);
    const { data: row, error } = await supabase
      .from("orders")
      .select("*")
      .eq(isUuid ? "id" : "order_number", order)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!row) return errorResult(`Order not found: ${order}`);
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", (row as { id: string }).id);
    return jsonResult({ order: row, items: items ?? [] });
  },
});
