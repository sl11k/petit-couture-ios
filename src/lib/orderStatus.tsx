// Order status constants + helpers (Arabic UI labels + colors)
import { supabase } from "@/integrations/supabase/client";

export const ORDER_STATUSES = [
  "pending",
  "payment_failed",
  "paid",
  "under_review",
  "processing",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "partially_refunded",
  "refunded",
  "fraud",
  "pending_customer",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "جديد",
  payment_failed: "فشل الدفع",
  paid: "مدفوع",
  under_review: "قيد المراجعة",
  processing: "قيد التجهيز",
  ready_to_ship: "جاهز للشحن",
  shipped: "تم الشحن",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مرتجع",
  partially_refunded: "استرداد جزئي",
  refunded: "مسترد بالكامل",
  fraud: "مرفوض/احتيال",
  pending_customer: "بانتظار العميل",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  payment_failed: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800",
  under_review: "bg-orange-100 text-orange-800",
  processing: "bg-indigo-100 text-indigo-800",
  ready_to_ship: "bg-cyan-100 text-cyan-800",
  shipped: "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-fuchsia-100 text-fuchsia-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-gray-200 text-gray-800",
  partially_refunded: "bg-amber-100 text-amber-800",
  refunded: "bg-gray-100 text-gray-700",
  fraud: "bg-red-200 text-red-900",
  pending_customer: "bg-yellow-50 text-yellow-700",
};

export const PAYMENT_STATUSES = [
  "unpaid",
  "awaiting_payment",
  "paid",
  "failed",
  "refund_processing",
  "partially_refunded",
  "refunded",
  "cod",
  "bank_pending_review",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "غير مدفوع",
  awaiting_payment: "بانتظار الدفع",
  paid: "مدفوع",
  failed: "فشل الدفع",
  refund_processing: "استرجاع قيد المعالجة",
  partially_refunded: "مسترجع جزئياً",
  refunded: "مسترجع بالكامل",
  cod: "دفع عند الاستلام",
  bank_pending_review: "تحويل بنكي قيد المراجعة",
};

export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  unpaid: "bg-gray-100 text-gray-700",
  awaiting_payment: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refund_processing: "bg-amber-100 text-amber-800",
  partially_refunded: "bg-amber-100 text-amber-800",
  refunded: "bg-gray-100 text-gray-700",
  cod: "bg-blue-100 text-blue-800",
  bank_pending_review: "bg-orange-100 text-orange-800",
};

export const SHIPPING_STATUSES = [
  "not_created",
  "awaiting_carrier",
  "label_created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "returned_to_sender",
  "lost",
  "delayed",
] as const;

export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];

export const SHIPPING_STATUS_LABEL: Record<string, string> = {
  not_created: "لم تُنشأ شحنة",
  awaiting_carrier: "بانتظار شركة الشحن",
  label_created: "تم إنشاء البوليصة",
  picked_up: "تم استلام الشحنة",
  in_transit: "في الطريق",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  delivery_failed: "فشل التسليم",
  returned_to_sender: "مرتجع للشركة",
  lost: "مفقود",
  delayed: "متأخر",
};

export const SHIPPING_STATUS_COLOR: Record<string, string> = {
  not_created: "bg-gray-100 text-gray-700",
  awaiting_carrier: "bg-yellow-100 text-yellow-800",
  label_created: "bg-blue-100 text-blue-800",
  picked_up: "bg-cyan-100 text-cyan-800",
  in_transit: "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-fuchsia-100 text-fuchsia-800",
  delivered: "bg-green-100 text-green-800",
  delivery_failed: "bg-red-100 text-red-800",
  returned_to_sender: "bg-gray-200 text-gray-800",
  lost: "bg-red-200 text-red-900",
  delayed: "bg-amber-100 text-amber-800",
};

export const SHIPPING_CARRIERS = ["SMSA", "Aramex", "DHL", "FedEx", "Naqel", "iMile", "أخرى"];

export const ORDER_SOURCES = ["web", "mobile", "admin", "whatsapp", "phone"] as const;
export const ORDER_SOURCE_LABEL: Record<string, string> = {
  web: "ويب",
  mobile: "موبايل",
  admin: "أدمن",
  whatsapp: "واتساب",
  phone: "هاتف",
};

// Generic badge component
export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}

// Audit log helper for timeline events
export async function logOrderEvent(
  orderId: string,
  action: string,
  metadata: Record<string, any> = {},
  actorEmail?: string | null,
) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_id: auth.user?.id ?? null,
      actor_email: actorEmail ?? auth.user?.email ?? null,
      action,
      entity: "order",
      entity_id: orderId,
      metadata,
    });
  } catch (e) {
    console.warn("audit log failed", e);
  }
}
