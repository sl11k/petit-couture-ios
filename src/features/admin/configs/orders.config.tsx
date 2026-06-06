import type { AdminPageConfig } from "@/features/admin/types";
import { Eye } from "lucide-react";

export const ordersConfig: AdminPageConfig = {
  title: { ar: "الطلبات", en: "Orders" },
  table: "orders",
  orderBy: { column: "created_at", ascending: false },
  // Pull each order's item SKUs so admins can search orders by SKU.
  select: "*, order_items(sku)",
  enrichRows: (rows: any[]) =>
    rows.map((r) => ({
      ...r,
      _skus: (r.order_items ?? []).map((i: any) => i?.sku).filter(Boolean).join(" "),
    })),
  rowHref: (row) => `/admin/orders/${row.id}`,
  columns: [
    { key: "order_number", label: { ar: "رقم الطلب", en: "Order #" } },
    { key: "customer_name", label: { ar: "العميل", en: "Customer" } },
    { key: "total", label: { ar: "الإجمالي", en: "Total" }, type: "currency" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "payment_status", label: { ar: "الدفع", en: "Payment" }, type: "badge", hideOnMobile: true },
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    {
      key: "search",
      type: "search",
      columns: ["order_number", "customer_name", "customer_email", "customer_phone", "_skus"],
      placeholder: { ar: "بحث بالرقم أو الاسم أو SKU...", en: "Search by #, name or SKU..." },
    },
    {
      key: "status",
      type: "select",
      label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "pending", label: { ar: "قيد الانتظار", en: "Pending" } },
        { value: "processing", label: { ar: "قيد التنفيذ", en: "Processing" } },
        { value: "shipped", label: { ar: "تم الشحن", en: "Shipped" } },
        { value: "delivered", label: { ar: "تم التسليم", en: "Delivered" } },
        { value: "cancelled", label: { ar: "ملغي", en: "Cancelled" } },
      ],
    },
    {
      key: "payment_status",
      type: "select",
      label: { ar: "الدفع", en: "Payment" },
      options: [
        { value: "paid", label: { ar: "مدفوع", en: "Paid" } },
        { value: "unpaid", label: { ar: "غير مدفوع", en: "Unpaid" } },
        { value: "refunded", label: { ar: "مسترجع", en: "Refunded" } },
      ],
    },
  ],
  actions: { export: true },
  rowActions: [
    {
      key: "view",
      label: { ar: "عرض", en: "View" },
      icon: <Eye className="h-3.5 w-3.5" />,
      to: (row) => `/admin/orders/${row.id}`,
    },
  ],
};

ordersConfig.actions = { ...ordersConfig.actions, edit: true };
ordersConfig.form = [
  { key: "status", label: { ar: "حالة الطلب", en: "Order status" }, type: "select", required: true, options: [
    { value: "pending", label: { ar: "قيد الانتظار", en: "Pending" } },
    { value: "processing", label: { ar: "قيد التنفيذ", en: "Processing" } },
    { value: "shipped", label: { ar: "تم الشحن", en: "Shipped" } },
    { value: "delivered", label: { ar: "تم التسليم", en: "Delivered" } },
    { value: "cancelled", label: { ar: "ملغي", en: "Cancelled" } },
    { value: "refunded", label: { ar: "مسترد", en: "Refunded" } },
  ]},
  { key: "payment_status", label: { ar: "حالة الدفع", en: "Payment status" }, type: "select", required: true, options: [
    { value: "paid", label: { ar: "مدفوع", en: "Paid" } },
    { value: "unpaid", label: { ar: "غير مدفوع", en: "Unpaid" } },
    { value: "partially_paid", label: { ar: "مدفوع جزئياً", en: "Partially paid" } },
    { value: "refunded", label: { ar: "مسترجع", en: "Refunded" } },
    { value: "failed", label: { ar: "فشل", en: "Failed" } },
  ]},
  { key: "tracking_number", label: { ar: "رقم التتبع", en: "Tracking number" }, type: "text" },
  { key: "shipping_carrier", label: { ar: "شركة الشحن", en: "Carrier" }, type: "text" },
  { key: "notes", label: { ar: "ملاحظات داخلية", en: "Admin notes" }, type: "textarea", rows: 3 },
];
