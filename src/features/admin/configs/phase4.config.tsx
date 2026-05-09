import type { AdminPageConfig } from "@/features/admin/types";

export const campaignsConfig: AdminPageConfig = {
  title: { ar: "الحملات التسويقية", en: "Marketing Campaigns" },
  table: "marketing_campaigns",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "campaign_type", label: { ar: "النوع", en: "Type" }, type: "badge" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "target_audience", label: { ar: "الجمهور", en: "Audience" }, hideOnMobile: true },
    { key: "sent_count", label: { ar: "أُرسل", en: "Sent" }, type: "number", hideOnMobile: true },
    { key: "open_count", label: { ar: "فُتح", en: "Opens" }, type: "number", hideOnMobile: true },
    { key: "starts_at", label: { ar: "يبدأ", en: "Starts" }, type: "date", hideOnMobile: true },
    { key: "ends_at", label: { ar: "ينتهي", en: "Ends" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name", "coupon_code"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "draft", label: { ar: "مسودة", en: "Draft" } },
        { value: "scheduled", label: { ar: "مجدولة", en: "Scheduled" } },
        { value: "active", label: { ar: "نشطة", en: "Active" } },
        { value: "paused", label: { ar: "متوقفة", en: "Paused" } },
        { value: "ended", label: { ar: "منتهية", en: "Ended" } },
      ],
    },
    {
      key: "campaign_type", type: "select", label: { ar: "النوع", en: "Type" },
      options: [
        { value: "banner", label: { ar: "بانر", en: "Banner" } },
        { value: "email", label: { ar: "إيميل", en: "Email" } },
        { value: "sms", label: { ar: "SMS", en: "SMS" } },
        { value: "push", label: { ar: "إشعار", en: "Push" } },
      ],
    },
  ],
  actions: { export: true },
};

export const landingPagesConfig: AdminPageConfig = {
  title: { ar: "صفحات الهبوط", en: "Landing Pages" },
  table: "landing_pages",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "title", label: { ar: "العنوان", en: "Title" } },
    { key: "slug", label: { ar: "الرابط", en: "Slug" } },
    { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean" },
    { key: "views", label: { ar: "المشاهدات", en: "Views" }, type: "number" },
    { key: "coupon_code", label: { ar: "الكوبون", en: "Coupon" }, hideOnMobile: true },
    { key: "utm_campaign", label: { ar: "UTM", en: "UTM" }, hideOnMobile: true },
    { key: "created_at", label: { ar: "أُنشئت", en: "Created" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title", "slug", "utm_campaign"] },
    {
      key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "true", label: { ar: "نشطة", en: "Active" } },
        { value: "false", label: { ar: "متوقفة", en: "Inactive" } },
      ],
    },
  ],
  actions: { export: true },
};

export const searchLogsConfig: AdminPageConfig = {
  title: { ar: "سجل البحث", en: "Search Logs" },
  description: { ar: "آخر عمليات البحث في المتجر", en: "Recent storefront searches" },
  table: "search_logs",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
    { key: "query", label: { ar: "الكلمة", en: "Query" } },
    { key: "results_count", label: { ar: "النتائج", en: "Results" }, type: "number" },
    { key: "user_id", label: { ar: "المستخدم", en: "User" }, hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["query"] },
  ],
  actions: { export: true },
};

export const storefrontConfig: AdminPageConfig = {
  title: { ar: "بانرات المتجر", en: "Storefront Banners" },
  table: "storefront_banners",
  orderBy: { column: "sort_order" },
  columns: [
    { key: "image_url", label: { ar: "الصورة", en: "Image" }, type: "image", width: "w-20" },
    { key: "title_ar", label: { ar: "العنوان", en: "Title" } },
    { key: "cta_url", label: { ar: "الرابط", en: "CTA URL" }, hideOnMobile: true },
    { key: "sort_order", label: { ar: "الترتيب", en: "Order" }, type: "number" },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title_ar", "title_en"] },
  ],
};

export const homeBuilderConfig: AdminPageConfig = {
  title: { ar: "محرر الصفحة الرئيسية", en: "Home Builder" },
  description: { ar: "أقسام الصفحة الرئيسية", en: "Home page sections" },
  table: "home_sections",
  orderBy: { column: "position" },
  columns: [
    { key: "position", label: { ar: "#", en: "#" }, type: "number", width: "w-12" },
    { key: "kind", label: { ar: "النوع", en: "Type" }, type: "badge" },
    { key: "title_ar", label: { ar: "العنوان", en: "Title" } },
    { key: "data_source", label: { ar: "المصدر", en: "Source" }, type: "badge", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title_ar", "title_en", "kind"] },
  ],
};

export const contentConfig: AdminPageConfig = {
  title: { ar: "صفحات المحتوى", en: "Content Pages" },
  table: "content_pages",
  orderBy: { column: "sort_order" },
  columns: [
    { key: "title_ar", label: { ar: "العنوان", en: "Title" } },
    { key: "slug", label: { ar: "الرابط", en: "Slug" } },
    { key: "is_published", label: { ar: "منشورة", en: "Published" }, type: "boolean" },
    { key: "show_in_footer", label: { ar: "في التذييل", en: "In footer" }, type: "boolean", hideOnMobile: true },
    { key: "sort_order", label: { ar: "الترتيب", en: "Order" }, type: "number", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title_ar", "title_en", "slug"] },
    {
      key: "is_published", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "true", label: { ar: "منشورة", en: "Published" } },
        { value: "false", label: { ar: "مسودة", en: "Draft" } },
      ],
    },
  ],
};

export const errorLogsConfig: AdminPageConfig = {
  title: { ar: "سجل الأخطاء", en: "Error Logs" },
  table: "error_logs",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
    { key: "severity", label: { ar: "الشدة", en: "Severity" }, type: "badge" },
    { key: "category", label: { ar: "الفئة", en: "Category" }, type: "badge", hideOnMobile: true },
    { key: "code", label: { ar: "الكود", en: "Code" } },
    { key: "message_admin", label: { ar: "الرسالة", en: "Message" } },
    { key: "resolved", label: { ar: "محلول", en: "Resolved" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["code", "message_admin"] },
    {
      key: "severity", type: "select", label: { ar: "الشدة", en: "Severity" },
      options: [
        { value: "info", label: { ar: "معلومة", en: "Info" } },
        { value: "warning", label: { ar: "تحذير", en: "Warning" } },
        { value: "error", label: { ar: "خطأ", en: "Error" } },
        { value: "critical", label: { ar: "حرج", en: "Critical" } },
      ],
    },
    {
      key: "resolved", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "false", label: { ar: "نشط", en: "Open" } },
        { value: "true", label: { ar: "محلول", en: "Resolved" } },
      ],
    },
  ],
  actions: { export: true },
};

export const abandonedConfig: AdminPageConfig = {
  title: { ar: "السلال المتروكة", en: "Abandoned Carts" },
  table: "abandoned_carts",
  orderBy: { column: "updated_at", ascending: false },
  columns: [
    { key: "updated_at", label: { ar: "آخر نشاط", en: "Last activity" }, type: "datetime" },
    { key: "email", label: { ar: "البريد", en: "Email" } },
    { key: "phone", label: { ar: "الهاتف", en: "Phone" }, hideOnMobile: true },
    { key: "subtotal", label: { ar: "المجموع", en: "Subtotal" }, type: "currency" },
    { key: "stage", label: { ar: "المرحلة", en: "Stage" }, type: "badge" },
    { key: "reached_checkout", label: { ar: "وصل للدفع", en: "Reached checkout" }, type: "boolean", hideOnMobile: true },
    { key: "converted", label: { ar: "تحول", en: "Converted" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["email", "phone"] },
    {
      key: "stage", type: "select", label: { ar: "المرحلة", en: "Stage" },
      options: [
        { value: "cart", label: { ar: "سلة", en: "Cart" } },
        { value: "checkout", label: { ar: "دفع", en: "Checkout" } },
        { value: "payment", label: { ar: "دفع", en: "Payment" } },
      ],
    },
    {
      key: "converted", type: "select", label: { ar: "التحويل", en: "Converted" },
      options: [
        { value: "false", label: { ar: "لا", en: "No" } },
        { value: "true", label: { ar: "نعم", en: "Yes" } },
      ],
    },
  ],
  actions: { export: true },
};

export const incompleteConfig: AdminPageConfig = {
  title: { ar: "طلبات غير مكتملة", en: "Incomplete Orders" },
  description: { ar: "وصلت لمرحلة الدفع ولم تكتمل", en: "Reached checkout but didn't convert" },
  table: "abandoned_carts",
  orderBy: { column: "updated_at", ascending: false },
  columns: [
    { key: "updated_at", label: { ar: "آخر نشاط", en: "Last activity" }, type: "datetime" },
    { key: "email", label: { ar: "البريد", en: "Email" } },
    { key: "phone", label: { ar: "الهاتف", en: "Phone" }, hideOnMobile: true },
    { key: "subtotal", label: { ar: "المجموع", en: "Subtotal" }, type: "currency" },
    { key: "stage", label: { ar: "المرحلة", en: "Stage" }, type: "badge" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["email", "phone"] },
  ],
  actions: { export: true },
};

export const helpConfig: AdminPageConfig = {
  title: { ar: "المساعدة والمقالات", en: "Help Articles" },
  table: "admin_help_articles",
  orderBy: { column: "sort_order" },
  columns: [
    { key: "title_ar", label: { ar: "العنوان", en: "Title" } },
    { key: "category", label: { ar: "الفئة", en: "Category" }, type: "badge", hideOnMobile: true },
    { key: "is_published", label: { ar: "منشور", en: "Published" }, type: "boolean" },
    { key: "sort_order", label: { ar: "الترتيب", en: "Order" }, type: "number", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title_ar", "title_en"] },
  ],
};
