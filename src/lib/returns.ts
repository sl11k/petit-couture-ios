import { supabase } from "@/integrations/supabase/client";

export const RETURN_STATUSES = [
  "new", "under_review", "approved", "rejected",
  "awaiting_pickup", "received", "refunding", "refunded", "closed",
] as const;
export type ReturnStatus = typeof RETURN_STATUSES[number];

export const STATUS_LABELS: Record<ReturnStatus, string> = {
  new: "طلب جديد",
  under_review: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  awaiting_pickup: "بانتظار استلام المنتج",
  received: "تم استلام المنتج",
  refunding: "قيد الاسترداد",
  refunded: "تم الاسترداد",
  closed: "مغلق",
};

export const STATUS_COLORS: Record<ReturnStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  awaiting_pickup: "bg-purple-100 text-purple-800",
  received: "bg-indigo-100 text-indigo-800",
  refunding: "bg-cyan-100 text-cyan-800",
  refunded: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-700",
};

export async function isOrderEligibleForReturn(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase.from("orders").select("id, status, created_at, updated_at").eq("id", orderId).maybeSingle(),
    supabase.from("return_settings").select("return_window_days").maybeSingle(),
  ]);
  if (!order) return { ok: false, reason: "الطلب غير موجود" };
  if (!["delivered"].includes(order.status as string)) return { ok: false, reason: "يمكن الإرجاع فقط بعد التسليم" };
  const days = settings?.return_window_days ?? 14;
  const refDate = new Date(order.updated_at || order.created_at);
  const now = new Date();
  const diff = (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diff > days) return { ok: false, reason: `انتهت مدة الإرجاع المسموحة (${days} يوماً)` };
  return { ok: true };
}

export async function restockItems(returnRequestId: string) {
  const { data: items } = await supabase
    .from("return_items")
    .select("product_id, qty, restock, inspection_status")
    .eq("return_request_id", returnRequestId);
  if (!items) return;
  for (const it of items) {
    if (!it.product_id || !it.restock) continue;
    if (it.inspection_status === "damaged") continue;
    const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).maybeSingle();
    if (p) {
      await supabase.from("products").update({ stock: (p.stock ?? 0) + (it.qty ?? 0) }).eq("id", it.product_id);
    }
  }
}
