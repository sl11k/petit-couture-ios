import type { AdminDetailConfig } from "@/features/admin/types";
import { ordersConfig } from "./orders.config";
import { DollarSign, Truck } from "lucide-react";
import { createStripeRefund } from "@/lib/stripe.functions";
import { otoCreateShipment, otoSyncShipment } from "@/lib/oto.functions";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notifications";
import { toast } from "sonner";

const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: { ar: "قيد الانتظار", en: "Pending" } },
  { value: "processing", label: { ar: "قيد التنفيذ", en: "Processing" } },
  { value: "shipped", label: { ar: "تم الشحن", en: "Shipped" } },
  { value: "delivered", label: { ar: "تم التسليم", en: "Delivered" } },
  { value: "cancelled", label: { ar: "ملغي", en: "Cancelled" } },
  { value: "refunded", label: { ar: "مسترد", en: "Refunded" } },
];

export const orderDetailConfig: AdminDetailConfig = {
  table: "orders",
  backTo: "/admin/orders",
  backLabel: { ar: "العودة للطلبات", en: "Back to orders" },
  title: (row) => `#${row.order_number}`,
  description: (row) => ({
    ar: `${row.customer_name ?? ""} • ${new Date(row.created_at).toLocaleString("ar")}`,
    en: `${row.customer_name ?? ""} • ${new Date(row.created_at).toLocaleString("en")}`,
  }),
  editForm: ordersConfig.form,
  actions: [
    {
      key: "refund",
      label: { ar: "استرداد", en: "Refund" },
      icon: <DollarSign className="h-3 w-3" />,
      variant: "danger",
      onClick: async (row) => {
        if (row.payment_gateway !== "stripe") {
          toast.error("Refunds are only available for Stripe payments");
          return;
        }
        
        // Get the captured transaction for this order
        const { data: transaction } = await supabase
          .from("payment_transactions")
          .select("*")
          .eq("order_id", row.id)
          .eq("gateway", "stripe")
          .eq("status", "captured")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!transaction) {
          toast.error("No captured Stripe transaction found for this order");
          return;
        }
        
        const amount = parseFloat(prompt("Enter refund amount:", String(row.total)) || "0");
        if (isNaN(amount) || amount <= 0) {
          toast.error("Invalid refund amount");
          return;
        }
        
        if (amount > row.total) {
          toast.error("Refund amount cannot exceed order total");
          return;
        }
        
        try {
          const result = await createStripeRefund({ data: { transaction_id: transaction.id, amount } });
          if (result.ok) {
            toast.success(`Refund of ${amount} ${row.currency} processed successfully`);
            // Notify customer via WhatsApp
            try {
              await notify({
                event_code: "payment_refunded",
                audience: "customer",
                recipient_user_id: row.user_id ?? null,
                recipient_email: row.customer_email ?? null,
                recipient_phone: row.customer_phone ?? null,
                variables: {
                  order_number: row.order_number,
                  amount,
                  currency: row.currency,
                  customer_name: row.customer_name ?? "",
                },
                related_entity: "order",
                related_entity_id: row.id,
              });
            } catch { /* noop */ }
          } else {
            toast.error("Refund failed");
          }
        } catch (e: any) {
          toast.error(e?.message || "Refund failed");
        }
      },
    },
  ],
  sections: [
    {
      title: { ar: "ملخص الطلب", en: "Order summary" },
      fields: [
        { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
        { key: "payment_status", label: { ar: "حالة الدفع", en: "Payment" }, type: "badge" },
        { key: "shipping_status", label: { ar: "حالة الشحن", en: "Shipping" }, type: "badge" },
        { key: "payment_method", label: { ar: "طريقة الدفع", en: "Payment method" }, type: "badge" },
        { key: "subtotal", label: { ar: "المجموع الفرعي", en: "Subtotal" }, type: "currency" },
        { key: "shipping_fee", label: { ar: "الشحن", en: "Shipping" }, type: "currency" },
        { key: "tax", label: { ar: "الضريبة", en: "Tax" }, type: "currency" },
        { key: "total", label: { ar: "الإجمالي", en: "Total" }, type: "currency" },
      ],
    },
    {
      title: { ar: "الشحن والتتبع", en: "Shipping & tracking" },
      fields: [
        { key: "shipping_carrier", label: { ar: "شركة الشحن", en: "Carrier" } },
        { key: "tracking_number", label: { ar: "رقم التتبع", en: "Tracking #" } },
        { key: "tracking_url", label: { ar: "رابط التتبع", en: "Tracking URL" }, type: "url", hideIfEmpty: true },
        { key: "shipping_address", label: { ar: "عنوان الشحن", en: "Shipping address" }, type: "address", span: 2 },
      ],
    },
    {
      title: { ar: "ملاحظات", en: "Notes" },
      columns: 1,
      fields: [
        { key: "notes", label: { ar: "ملاحظات العميل", en: "Customer notes" }, type: "longtext", hideIfEmpty: true },
        { key: "internal_notes", label: { ar: "ملاحظات داخلية", en: "Internal notes" }, type: "json", hideIfEmpty: true },
      ],
    },
    // Sidebar
    {
      sidebar: true,
      title: { ar: "العميل", en: "Customer" },
      columns: 1,
      fields: [
        { key: "customer_name", label: { ar: "الاسم", en: "Name" } },
        { key: "customer_email", label: { ar: "البريد", en: "Email" }, type: "email" },
        { key: "customer_phone", label: { ar: "الهاتف", en: "Phone" }, type: "tel" },
      ],
    },
    {
      sidebar: true,
      title: { ar: "معلومات إضافية", en: "Additional info" },
      columns: 1,
      fields: [
        { key: "source", label: { ar: "المصدر", en: "Source" }, type: "badge" },
        { key: "invoice_number", label: { ar: "رقم الفاتورة", en: "Invoice #" }, hideIfEmpty: true },
        { key: "created_at", label: { ar: "تاريخ الإنشاء", en: "Created" }, type: "datetime" },
        { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime" },
        { key: "expires_at", label: { ar: "ينتهي في", en: "Expires" }, type: "datetime", hideIfEmpty: true },
      ],
    },
  ],
  related: [
    {
      title: { ar: "عناصر الطلب", en: "Order items" },
      table: "order_items",
      foreignKey: "order_id",
      orderBy: { column: "created_at", ascending: true },
      columns: [
        { key: "image_url", label: { ar: "الصورة", en: "Image" }, type: "image", width: "w-16" },
        { key: "product_name", label: { ar: "المنتج", en: "Product" } },
        { key: "sku", label: { ar: "SKU", en: "SKU" } },
        { key: "size", label: { ar: "المقاس", en: "Size" }, hideOnMobile: true },
        { key: "color", label: { ar: "اللون", en: "Color" }, hideOnMobile: true },
        { key: "qty", label: { ar: "الكمية", en: "Qty" }, type: "number" },
        { key: "unit_price", label: { ar: "السعر", en: "Price" }, type: "currency" },
        { key: "line_total", label: { ar: "الإجمالي", en: "Total" }, type: "currency" },
      ],
      rowHref: (r) => r.product_id ? `/admin/products/${r.product_id}` : "",
    },
    {
      title: { ar: "العمليات الأخيرة", en: "Recent activity" },
      table: "audit_logs",
      foreignKey: "entity_id",
      foreignKeyValue: (row) => row.id,
      extraEq: { entity: "orders" },
      orderBy: { column: "created_at", ascending: false },
      limit: 25,
      select: "id, action, actor_email, created_at, metadata",
      emptyMessage: { ar: "لا توجد عمليات مسجلة", en: "No recorded activity" },
      columns: [
        { key: "created_at", label: { ar: "الوقت", en: "Time" }, type: "datetime", width: "w-44" },
        { key: "action", label: { ar: "العملية", en: "Action" }, type: "badge" },
        { key: "actor_email", label: { ar: "المستخدم", en: "User" }, hideOnMobile: true },
        {
          key: "metadata",
          label: { ar: "تفاصيل", en: "Details" },
          hideOnMobile: true,
          render: (v: any) => {
            const changed = v?.changed_fields;
            if (!changed) return <span className="text-muted-foreground">—</span>;
            const keys = Object.keys(changed).slice(0, 3);
            return <span className="text-xs text-muted-foreground">{keys.join(", ")}{Object.keys(changed).length > 3 ? "…" : ""}</span>;
          },
        },
      ],
    },
  ],
};

// reference unused options to silence lint if any
void ORDER_STATUS_OPTIONS;
