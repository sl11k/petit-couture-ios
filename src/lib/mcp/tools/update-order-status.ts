import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_order_status",
  title: "Update order status",
  description: "Change an order's fulfilment status (e.g. processing, shipped, delivered). Requires staff permissions; customer notifications are sent automatically by the store.",
  inputSchema: {
    order_number: z.string().trim().min(1),
    status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
    tracking_number: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number, status, tracking_number }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const patch: Record<string, unknown> = { status };
    if (tracking_number) patch.tracking_number = tracking_number;
    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("order_number", order_number)
      .select("id, order_number, status, tracking_number, updated_at");
    if (error) return errorResult(error.message);
    if (!data?.length) return errorResult(`Order not found or not permitted: ${order_number}`);
    return jsonResult(data[0]);
  },
});
