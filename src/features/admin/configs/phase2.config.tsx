import type { AdminPageConfig } from "@/features/admin/types";
import { Eye } from "lucide-react";

export const couponsConfig: AdminPageConfig = {
  title: { ar: "الكوبونات", en: "Coupons" },
  table: "coupons",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "code", label: { ar: "الكود", en: "Code" } },
    { key: "name", label: { ar: "الاسم", en: "Name" }, hideOnMobile: true },
    { key: "discount_type", label: { ar: "نوع الخصم", en: "Type" } },
    { key: "discount_value", label: { ar: "القيمة", en: "Value" }, type: "number" },
    { key: "used_count", label: { ar: "الاستخدامات", en: "Uses" }, type: "number" },
    { key: "max_uses", label: { ar: "الحد الأقصى", en: "Max" }, type: "number", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
    { key: "expires_at", label: { ar: "ينتهي", en: "Expires" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["code", "name"] },
    {
      key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "true", label: { ar: "نشط", en: "Active" } },
        { value: "false", label: { ar: "متوقف", en: "Inactive" } },
      ],
    },
    {
      key: "discount_type", type: "select", label: { ar: "النوع", en: "Type" },
      options: [
        { value: "percentage", label: { ar: "نسبة", en: "Percentage" } },
        { value: "fixed", label: { ar: "ثابت", en: "Fixed" } },
        { value: "free_shipping", label: { ar: "شحن مجاني", en: "Free shipping" } },
      ],
    },
  ],
  actions: { export: true },
};

export const inventoryConfig: AdminPageConfig = {
  title: { ar: "المخزون", en: "Inventory" },
  description: { ar: "إدارة كميات المنتجات", en: "Manage product stock" },
  table: "products",
  orderBy: { column: "stock", ascending: true },
  rowHref: (row) => `/admin/products/${row.id}`,
  columns: [
    { key: "image_url", label: { ar: "الصورة", en: "Image" }, type: "image", width: "w-16" },
    { key: "name_ar", label: { ar: "المنتج", en: "Product" } },
    { key: "sku", label: { ar: "SKU", en: "SKU" }, hideOnMobile: true },
    { key: "stock", label: { ar: "المخزون", en: "Stock" }, type: "number" },
    {
      key: "stock", label: { ar: "الحالة", en: "Status" },
      render: (v) => {
        const n = Number(v ?? 0);
        if (n === 0) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">نفد</span>;
        if (n <= 5) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">منخفض</span>;
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">متوفر</span>;
      },
    },
    { key: "price", label: { ar: "السعر", en: "Price" }, type: "currency", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name_ar", "name_en", "sku"] },
  ],
  actions: { export: true },
  rowActions: [
    { key: "view", label: { ar: "عرض", en: "View" }, icon: <Eye className="h-3.5 w-3.5" />, to: (row) => `/admin/products/${row.id}` },
  ],
};

export const returnsConfig: AdminPageConfig = {
  title: { ar: "المرتجعات", en: "Returns" },
  table: "return_requests",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "return_number", label: { ar: "رقم الإرجاع", en: "Return #" } },
    { key: "order_number", label: { ar: "رقم الطلب", en: "Order #" }, hideOnMobile: true },
    { key: "customer_name", label: { ar: "العميل", en: "Customer" } },
    { key: "reason", label: { ar: "السبب", en: "Reason" }, hideOnMobile: true },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["return_number", "order_number", "customer_name", "customer_email"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "pending", label: { ar: "معلق", en: "Pending" } },
        { value: "approved", label: { ar: "موافق عليه", en: "Approved" } },
        { value: "rejected", label: { ar: "مرفوض", en: "Rejected" } },
        { value: "refunded", label: { ar: "تم الاسترداد", en: "Refunded" } },
        { value: "completed", label: { ar: "مكتمل", en: "Completed" } },
      ],
    },
  ],
  actions: { export: true },
};

export const invoicesConfig: AdminPageConfig = {
  title: { ar: "الفواتير", en: "Invoices" },
  table: "invoices",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "invoice_number", label: { ar: "رقم الفاتورة", en: "Invoice #" } },
    { key: "order_number", label: { ar: "رقم الطلب", en: "Order #" }, hideOnMobile: true },
    { key: "customer_name", label: { ar: "العميل", en: "Customer" } },
    { key: "total", label: { ar: "الإجمالي", en: "Total" }, type: "currency" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "invoice_type", label: { ar: "النوع", en: "Type" }, hideOnMobile: true },
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["invoice_number", "order_number", "customer_name", "customer_email"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "draft", label: { ar: "مسودة", en: "Draft" } },
        { value: "issued", label: { ar: "صادرة", en: "Issued" } },
        { value: "paid", label: { ar: "مدفوعة", en: "Paid" } },
        { value: "cancelled", label: { ar: "ملغاة", en: "Cancelled" } },
      ],
    },
  ],
  actions: { export: true },
};

export const paymentsConfig: AdminPageConfig = {
  title: { ar: "المدفوعات", en: "Payments" },
  table: "payment_transactions",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "order_number", label: { ar: "رقم الطلب", en: "Order #" } },
    { key: "customer_name", label: { ar: "العميل", en: "Customer" }, hideOnMobile: true },
    { key: "amount", label: { ar: "المبلغ", en: "Amount" }, type: "currency" },
    { key: "gateway", label: { ar: "البوابة", en: "Gateway" }, hideOnMobile: true },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "card_brand", label: { ar: "البطاقة", en: "Card" }, hideOnMobile: true },
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["order_number", "customer_name", "customer_email", "gateway_transaction_id"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "pending", label: { ar: "معلق", en: "Pending" } },
        { value: "succeeded", label: { ar: "ناجح", en: "Succeeded" } },
        { value: "failed", label: { ar: "فشل", en: "Failed" } },
        { value: "refunded", label: { ar: "مسترد", en: "Refunded" } },
      ],
    },
    {
      key: "gateway", type: "select", label: { ar: "البوابة", en: "Gateway" },
      options: [
        { value: "stripe", label: { ar: "Stripe", en: "Stripe" } },
        { value: "tap", label: { ar: "Tap", en: "Tap" } },
        { value: "moyasar", label: { ar: "Moyasar", en: "Moyasar" } },
        { value: "hyperpay", label: { ar: "HyperPay", en: "HyperPay" } },
        { value: "cod", label: { ar: "الدفع عند الاستلام", en: "COD" } },
      ],
    },
  ],
  actions: { export: true },
};

export const shippingConfig: AdminPageConfig = {
  title: { ar: "شركات الشحن", en: "Shipping carriers" },
  table: "shipping_carriers",
  orderBy: { column: "name_ar", ascending: true },
  columns: [
    { key: "logo_url", label: { ar: "الشعار", en: "Logo" }, type: "image", width: "w-16" },
    { key: "name_ar", label: { ar: "الاسم", en: "Name" } },
    { key: "code", label: { ar: "الكود", en: "Code" }, hideOnMobile: true },
    { key: "carrier_type", label: { ar: "النوع", en: "Type" }, hideOnMobile: true },
    { key: "supports_cod", label: { ar: "يدعم COD", en: "COD" }, type: "boolean", hideOnMobile: true },
    { key: "supports_tracking", label: { ar: "تتبع", en: "Tracking" }, type: "boolean", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name_ar", "name_en", "code"] },
    {
      key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "true", label: { ar: "نشط", en: "Active" } },
        { value: "false", label: { ar: "متوقف", en: "Inactive" } },
      ],
    },
  ],
  actions: { export: true },
};

export const reportsConfig: AdminPageConfig = {
  title: { ar: "التقارير", en: "Reports" },
  description: { ar: "سجل تشغيل التقارير المجدولة", en: "Scheduled report runs log" },
  table: "report_runs",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "report_key", label: { ar: "نوع التقرير", en: "Report" } },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "rows_count", label: { ar: "السجلات", en: "Rows" }, type: "number", hideOnMobile: true },
    { key: "triggered_by_email", label: { ar: "بواسطة", en: "By" }, hideOnMobile: true },
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["report_key", "triggered_by_email"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "running", label: { ar: "جارٍ", en: "Running" } },
        { value: "completed", label: { ar: "مكتمل", en: "Completed" } },
        { value: "failed", label: { ar: "فشل", en: "Failed" } },
      ],
    },
  ],
  actions: { export: true },
};

// Add row navigation to detail pages
couponsConfig.rowHref = (row: any) => `/admin/coupons/${row.id}`;

couponsConfig.actions = { ...couponsConfig.actions, create: true, edit: true, delete: true };
couponsConfig.form = [
  { key: "code", label: { ar: "كود الكوبون", en: "Coupon code" }, type: "text", required: true, maxLength: 40, helpText: { ar: "بدون مسافات، يحوّل لأحرف كبيرة", en: "No spaces, will be uppercased" } },
  { key: "name", label: { ar: "اسم العرض", en: "Display name" }, type: "text", maxLength: 120 },
  { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 2 },
  { key: "discount_type", label: { ar: "نوع الخصم", en: "Discount type" }, type: "select", required: true, defaultValue: "percent", options: [
    { value: "percent", label: { ar: "نسبة %", en: "Percentage" } },
    { value: "fixed", label: { ar: "مبلغ ثابت", en: "Fixed amount" } },
    { value: "free_shipping", label: { ar: "شحن مجاني", en: "Free shipping" } },
  ]},
  { key: "discount_value", label: { ar: "قيمة الخصم", en: "Discount value" }, type: "number", required: true, min: 0, step: 0.01 },
  { key: "min_subtotal", label: { ar: "الحد الأدنى للسلة", en: "Min subtotal" }, type: "number", min: 0, step: 0.01 },
  { key: "max_uses", label: { ar: "أقصى عدد استخدامات", en: "Max uses" }, type: "number", min: 0 },
  { key: "per_customer_limit", label: { ar: "حد لكل عميل", en: "Per-customer limit" }, type: "number", min: 0 },
  { key: "starts_at", label: { ar: "يبدأ من", en: "Starts at" }, type: "datetime" },
  { key: "expires_at", label: { ar: "ينتهي في", en: "Expires at" }, type: "datetime" },
  { key: "first_order_only", label: { ar: "أول طلب فقط", en: "First order only" }, type: "boolean" },
  { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
];

returnsConfig.actions = { ...returnsConfig.actions, edit: true };
returnsConfig.form = [
  { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", required: true, options: [
    { value: "new", label: { ar: "جديد", en: "New" } },
    { value: "pending", label: { ar: "معلق", en: "Pending" } },
    { value: "approved", label: { ar: "موافق عليه", en: "Approved" } },
    { value: "rejected", label: { ar: "مرفوض", en: "Rejected" } },
    { value: "refunded", label: { ar: "مسترد", en: "Refunded" } },
    { value: "completed", label: { ar: "مكتمل", en: "Completed" } },
  ]},
  { key: "refund_method", label: { ar: "طريقة الاسترداد", en: "Refund method" }, type: "select", options: [
    { value: "original", label: { ar: "نفس وسيلة الدفع", en: "Original method" } },
    { value: "wallet", label: { ar: "محفظة", en: "Wallet" } },
    { value: "bank_transfer", label: { ar: "حوالة بنكية", en: "Bank transfer" } },
  ]},
  { key: "refund_amount", label: { ar: "المبلغ المسترد", en: "Refund amount" }, type: "number", min: 0, step: 0.01 },
  { key: "shipping_fee_deducted", label: { ar: "رسوم الشحن المخصومة", en: "Shipping fee deducted" }, type: "number", min: 0, step: 0.01 },
  { key: "return_shipping_carrier", label: { ar: "شركة شحن الإرجاع", en: "Return carrier" }, type: "text" },
  { key: "return_tracking_number", label: { ar: "رقم تتبع الإرجاع", en: "Return tracking #" }, type: "text" },
  { key: "decision_reason", label: { ar: "سبب القرار", en: "Decision reason" }, type: "textarea", rows: 3 },
];

invoicesConfig.actions = { ...invoicesConfig.actions, edit: true };
invoicesConfig.form = [
  { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", required: true, options: [
    { value: "draft", label: { ar: "مسودة", en: "Draft" } },
    { value: "issued", label: { ar: "صادرة", en: "Issued" } },
    { value: "paid", label: { ar: "مدفوعة", en: "Paid" } },
    { value: "cancelled", label: { ar: "ملغاة", en: "Cancelled" } },
  ]},
];

shippingConfig.actions = { ...shippingConfig.actions, create: true, edit: true, delete: true };
shippingConfig.form = [
  { key: "code", label: { ar: "الكود", en: "Code" }, type: "text", required: true, maxLength: 30, pattern: "^[a-z0-9_-]+$" },
  { key: "name_ar", label: { ar: "الاسم (AR)", en: "Name (AR)" }, type: "text", required: true },
  { key: "name_en", label: { ar: "الاسم (EN)", en: "Name (EN)" }, type: "text", required: true },
  { key: "carrier_type", label: { ar: "النوع", en: "Type" }, type: "select", defaultValue: "local", options: [
    { value: "local", label: { ar: "محلي", en: "Local" } },
    { value: "international", label: { ar: "دولي", en: "International" } },
    { value: "express", label: { ar: "سريع", en: "Express" } },
  ]},
  { key: "logo_url", label: { ar: "شعار الناقل", en: "Carrier logo" }, type: "image", bucket: "content-media", folder: "carriers" },
  { key: "api_endpoint", label: { ar: "API Endpoint", en: "API endpoint" }, type: "url" },
  { key: "default_delivery_days_min", label: { ar: "أقل أيام تسليم", en: "Min delivery days" }, type: "number", min: 0, defaultValue: 1 },
  { key: "default_delivery_days_max", label: { ar: "أكثر أيام تسليم", en: "Max delivery days" }, type: "number", min: 0, defaultValue: 5 },
  { key: "display_order", label: { ar: "الترتيب", en: "Sort order" }, type: "number", min: 0, defaultValue: 0 },
  { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  { key: "supports_cod", label: { ar: "يدعم الدفع عند الاستلام", en: "Supports COD" }, type: "boolean" },
  { key: "supports_tracking", label: { ar: "يدعم التتبع", en: "Supports tracking" }, type: "boolean", defaultValue: true },
  { key: "supports_international", label: { ar: "يدعم الدولي", en: "Supports international" }, type: "boolean" },
  { key: "supports_webhook", label: { ar: "يدعم Webhook", en: "Supports webhook" }, type: "boolean" },
  { key: "api_credentials", label: { ar: "بيانات الاعتماد (JSON)", en: "API credentials (JSON)" }, type: "json" },
];
