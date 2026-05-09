import type { AdminDetailConfig } from "@/features/admin/types";
import { customersConfig } from "./misc.config";

export const customerDetailConfig: AdminDetailConfig = {
  table: "profiles",
  backTo: "/admin/customers",
  backLabel: { ar: "العودة للعملاء", en: "Back to customers" },
  title: (row) => row.full_name ?? row.email ?? "—",
  description: (row) => ({
    ar: `${row.email ?? ""}${row.phone ? " • " + row.phone : ""}`,
    en: `${row.email ?? ""}${row.phone ? " • " + row.phone : ""}`,
  }),
  editForm: customersConfig.form,
  sections: [
    {
      title: { ar: "بيانات العميل", en: "Customer info" },
      fields: [
        { key: "full_name", label: { ar: "الاسم الكامل", en: "Full name" } },
        { key: "email", label: { ar: "البريد", en: "Email" }, type: "email" },
        { key: "phone", label: { ar: "الهاتف", en: "Phone" }, type: "tel" },
        { key: "city", label: { ar: "المدينة", en: "City" } },
        { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
        { key: "tag", label: { ar: "وسم", en: "Tag" }, type: "badge", hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "ملاحظات داخلية", en: "Internal notes" },
      columns: 1,
      fields: [
        { key: "internal_notes", label: { ar: "ملاحظات", en: "Notes" }, type: "json", hideIfEmpty: true },
      ],
    },
    // Sidebar
    {
      sidebar: true,
      title: { ar: "تفاصيل الحساب", en: "Account details" },
      columns: 1,
      fields: [
        { key: "source", label: { ar: "المصدر", en: "Source" }, type: "badge" },
        { key: "loyalty_points", label: { ar: "نقاط الولاء", en: "Loyalty points" }, type: "number" },
        { key: "created_at", label: { ar: "تاريخ التسجيل", en: "Joined" }, type: "datetime" },
        { key: "last_contact_at", label: { ar: "آخر تواصل", en: "Last contact" }, type: "datetime", hideIfEmpty: true },
        { key: "user_id", label: { ar: "معرف المستخدم", en: "User ID" } },
      ],
    },
  ],
  related: [
    {
      title: { ar: "طلبات العميل", en: "Customer orders" },
      table: "orders",
      foreignKey: "user_id",
      foreignKeyValue: (row) => row.user_id,
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
      columns: [
        { key: "order_number", label: { ar: "رقم الطلب", en: "Order #" } },
        { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime", hideOnMobile: true },
        { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
        { key: "payment_status", label: { ar: "الدفع", en: "Payment" }, type: "badge", hideOnMobile: true },
        { key: "total", label: { ar: "الإجمالي", en: "Total" }, type: "currency" },
      ],
      rowHref: (r) => `/admin/orders/${r.id}`,
      emptyMessage: { ar: "لا توجد طلبات", en: "No orders" },
      footer: (rows) => {
        const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
        return (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{rows.length} طلب</span>
            <span className="font-semibold">{total.toLocaleString()} ر.س</span>
          </div>
        );
      },
    },
    {
      title: { ar: "تذاكر الدعم", en: "Support tickets" },
      table: "support_tickets",
      foreignKey: "customer_email",
      foreignKeyValue: (row) => row.email,
      orderBy: { column: "created_at", ascending: false },
      limit: 20,
      columns: [
        { key: "ticket_number", label: { ar: "رقم", en: "#" } },
        { key: "subject", label: { ar: "الموضوع", en: "Subject" } },
        { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
        { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime", hideOnMobile: true },
      ],
      rowHref: (r) => `/admin/support/${r.id}`,
      emptyMessage: { ar: "لا توجد تذاكر", en: "No tickets" },
    },
  ],
};
