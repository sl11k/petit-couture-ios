import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "List orders",
  description: "List recent orders visible to the signed-in user (staff see store orders; customers see their own). Filter by status, payment status or date range.",
  inputSchema: {
    status: z.string().trim().optional().describe("Order status, e.g. pending, processing, shipped, delivered, cancelled."),
    payment_status: z.string().trim().optional().describe("e.g. paid, pending, failed, refunded."),
    since: z.string().datetime().optional().describe("ISO date — only orders created after this."),
    search: z.string().trim().optional().describe("Match order number, customer name, email or phone."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, payment_status, since, search, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("orders")
      .select("id, order_number, status, payment_status, payment_gateway, payment_method, shipping_status, customer_name, customer_email, customer_phone, subtotal, discount_amount, shipping_fee, tax, total, currency, tracking_number, tracking_url, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (payment_status) q = q.eq("payment_status", payment_status);
    if (since) q = q.gte("created_at", since);
    if (search) {
      const safe = search.replace(/[%,()]/g, " ");
      q = q.or(`order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%,customer_phone.ilike.%${safe}%`);
    }
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
