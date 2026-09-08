import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

const PAID = new Set(["paid", "captured", "succeeded"]);

export default defineTool({
  name: "sales_summary",
  title: "Sales summary",
  description: "Summarize paid revenue, order count and average order value for the last N days (paid orders only, cancelled/refunded excluded from net).",
  inputSchema: {
    days: z.number().int().min(1).max(365).default(30),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .select("total, refunded_amount, payment_status, status, currency, created_at")
      .gte("created_at", since)
      .limit(5000);
    if (error) return errorResult(error.message);
    const rows = (data ?? []) as Array<{ total: number; refunded_amount: number | null; payment_status: string; status: string; currency: string }>;
    let paidOrders = 0, gross = 0, refunded = 0, cancelled = 0;
    for (const r of rows) {
      if (PAID.has(r.payment_status)) {
        paidOrders += 1;
        gross += Number(r.total) || 0;
        refunded += Number(r.refunded_amount) || 0;
        if (r.status === "cancelled") cancelled += Number(r.total) || 0;
      }
    }
    const net = gross - refunded - cancelled;
    return jsonResult({
      period_days: days,
      since,
      total_orders_seen: rows.length,
      paid_orders: paidOrders,
      gross_revenue: Number(gross.toFixed(2)),
      refunded: Number(refunded.toFixed(2)),
      cancelled_paid: Number(cancelled.toFixed(2)),
      net_revenue: Number(net.toFixed(2)),
      average_order_value: paidOrders ? Number((gross / paidOrders).toFixed(2)) : 0,
      currency: rows[0]?.currency ?? "SAR",
    });
  },
});
