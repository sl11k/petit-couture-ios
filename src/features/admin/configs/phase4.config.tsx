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

// Add row navigation to detail pages
campaignsConfig.rowHref = (row: any) => `/admin/campaigns/${row.id}`;
landingPagesConfig.rowHref = (row: any) => `/admin/landing-pages/${row.id}`;

campaignsConfig.actions = { ...campaignsConfig.actions, create: true, edit: true, delete: true };
campaignsConfig.form = [
  { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true, maxLength: 120 },
  { key: "campaign_type", label: { ar: "النوع", en: "Type" }, type: "select", required: true, defaultValue: "banner", options: [
    { value: "banner", label: { ar: "بانر", en: "Banner" } },
    { value: "email", label: { ar: "إيميل", en: "Email" } },
    { value: "sms", label: { ar: "SMS", en: "SMS" } },
    { value: "push", label: { ar: "إشعار", en: "Push" } },
  ]},
  { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", required: true, defaultValue: "draft", options: [
    { value: "draft", label: { ar: "مسودة", en: "Draft" } },
    { value: "scheduled", label: { ar: "مجدولة", en: "Scheduled" } },
    { value: "active", label: { ar: "نشطة", en: "Active" } },
    { value: "paused", label: { ar: "متوقفة", en: "Paused" } },
    { value: "ended", label: { ar: "منتهية", en: "Ended" } },
  ]},
  { key: "target_audience", label: { ar: "الجمهور", en: "Audience" }, type: "select", defaultValue: "all", options: [
    { value: "all", label: { ar: "الجميع", en: "All" } },
    { value: "new", label: { ar: "عملاء جدد", en: "New customers" } },
    { value: "returning", label: { ar: "عملاء عائدون", en: "Returning" } },
    { value: "vip", label: { ar: "VIP", en: "VIP" } },
  ]},
  { key: "starts_at", label: { ar: "يبدأ", en: "Starts at" }, type: "datetime" },
  { key: "ends_at", label: { ar: "ينتهي", en: "Ends at" }, type: "datetime" },
  { key: "coupon_code", label: { ar: "كود الكوبون", en: "Coupon code" }, type: "text" },
  { key: "banner_image_url", label: { ar: "صورة البانر", en: "Banner image" }, type: "image", bucket: "banner-media", folder: "campaigns" },
  { key: "banner_link_url", label: { ar: "رابط البانر", en: "Banner link" }, type: "url" },
  { key: "email_subject", label: { ar: "موضوع الإيميل", en: "Email subject" }, type: "text" },
  { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 3 },
  { key: "email_body", label: { ar: "نص الإيميل", en: "Email body" }, type: "textarea", rows: 6 },
];

landingPagesConfig.actions = { ...landingPagesConfig.actions, create: true, edit: true, delete: true };
landingPagesConfig.form = [
  { key: "title", label: { ar: "العنوان", en: "Title" }, type: "text", required: true, maxLength: 200 },
  { key: "slug", label: { ar: "Slug", en: "Slug" }, type: "text", required: true, pattern: "^[a-z0-9-]+$" },
  { key: "subtitle", label: { ar: "العنوان الفرعي", en: "Subtitle" }, type: "text" },
  { key: "hero_image", label: { ar: "صورة الهيرو", en: "Hero image URL" }, type: "url" },
  { key: "cta_text", label: { ar: "نص الزر", en: "CTA text" }, type: "text" },
  { key: "cta_url", label: { ar: "رابط الزر", en: "CTA URL" }, type: "url" },
  { key: "coupon_code", label: { ar: "كود الكوبون", en: "Coupon code" }, type: "text" },
  { key: "utm_campaign", label: { ar: "UTM Campaign", en: "UTM campaign" }, type: "text" },
  { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean", defaultValue: true },
];

storefrontConfig.actions = { ...storefrontConfig.actions, create: true, edit: true, delete: true };
storefrontConfig.form = [
  { key: "image_url", label: { ar: "رابط الصورة", en: "Image URL" }, type: "url", required: true },
  { key: "title_ar", label: { ar: "العنوان (AR)", en: "Title (AR)" }, type: "text" },
  { key: "title_en", label: { ar: "العنوان (EN)", en: "Title (EN)" }, type: "text" },
  { key: "subtitle_ar", label: { ar: "العنوان الفرعي (AR)", en: "Subtitle (AR)" }, type: "text" },
  { key: "subtitle_en", label: { ar: "العنوان الفرعي (EN)", en: "Subtitle (EN)" }, type: "text" },
  { key: "eyebrow_ar", label: { ar: "نص علوي (AR)", en: "Eyebrow (AR)" }, type: "text" },
  { key: "eyebrow_en", label: { ar: "نص علوي (EN)", en: "Eyebrow (EN)" }, type: "text" },
  { key: "cta_label_ar", label: { ar: "نص الزر (AR)", en: "CTA label (AR)" }, type: "text" },
  { key: "cta_label_en", label: { ar: "نص الزر (EN)", en: "CTA label (EN)" }, type: "text" },
  { key: "cta_url", label: { ar: "رابط الزر", en: "CTA URL" }, type: "url" },
  { key: "sort_order", label: { ar: "الترتيب", en: "Sort order" }, type: "number", min: 0, defaultValue: 0 },
  { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
];

homeBuilderConfig.actions = { ...homeBuilderConfig.actions, create: true, edit: true, delete: true };
homeBuilderConfig.form = [
  { key: "kind", label: { ar: "نوع القسم", en: "Section type" }, type: "select", required: true, options: [
    { value: "featured", label: { ar: "منتجات مميزة", en: "Featured" } },
    { value: "new_arrivals", label: { ar: "وصل حديثاً", en: "New arrivals" } },
    { value: "best_sellers", label: { ar: "الأكثر مبيعاً", en: "Best sellers" } },
    { value: "category", label: { ar: "تصنيف", en: "Category" } },
    { value: "banner", label: { ar: "بانر", en: "Banner" } },
    { value: "custom", label: { ar: "مخصص", en: "Custom" } },
  ]},
  { key: "title_ar", label: { ar: "العنوان (AR)", en: "Title (AR)" }, type: "text" },
  { key: "title_en", label: { ar: "العنوان (EN)", en: "Title (EN)" }, type: "text" },
  { key: "eyebrow_ar", label: { ar: "نص علوي (AR)", en: "Eyebrow (AR)" }, type: "text" },
  { key: "eyebrow_en", label: { ar: "نص علوي (EN)", en: "Eyebrow (EN)" }, type: "text" },
  { key: "data_source", label: { ar: "مصدر البيانات", en: "Data source" }, type: "select", defaultValue: "auto", options: [
    { value: "auto", label: { ar: "تلقائي", en: "Auto" } },
    { value: "manual", label: { ar: "يدوي", en: "Manual" } },
    { value: "category", label: { ar: "تصنيف", en: "Category" } },
  ]},
  { key: "source_ref", label: { ar: "المرجع (slug تصنيف مثلاً)", en: "Source ref (e.g. category slug)" }, type: "text" },
  { key: "position", label: { ar: "الترتيب", en: "Position" }, type: "number", min: 0, defaultValue: 0 },
  { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  { key: "config", label: { ar: "إعدادات (JSON)", en: "Config (JSON)" }, type: "json" },
];

contentConfig.actions = { ...contentConfig.actions, create: true, edit: true, delete: true };
contentConfig.form = [
  { key: "slug", label: { ar: "Slug", en: "Slug" }, type: "text", required: true, pattern: "^[a-z0-9-]+$" },
  { key: "title_ar", label: { ar: "العنوان (AR)", en: "Title (AR)" }, type: "text", required: true },
  { key: "title_en", label: { ar: "العنوان (EN)", en: "Title (EN)" }, type: "text", required: true },
  { key: "is_published", label: { ar: "منشورة", en: "Published" }, type: "boolean" },
  { key: "show_in_footer", label: { ar: "إظهار في التذييل", en: "Show in footer" }, type: "boolean" },
  { key: "sort_order", label: { ar: "الترتيب", en: "Sort order" }, type: "number", min: 0, defaultValue: 0 },
  { key: "meta_description_ar", label: { ar: "Meta Description (AR)", en: "Meta description (AR)" }, type: "textarea", rows: 2 },
  { key: "meta_description_en", label: { ar: "Meta Description (EN)", en: "Meta description (EN)" }, type: "textarea", rows: 2 },
  { key: "body_ar", label: { ar: "المحتوى (AR)", en: "Body (AR)" }, type: "textarea", rows: 10 },
  { key: "body_en", label: { ar: "المحتوى (EN)", en: "Body (EN)" }, type: "textarea", rows: 10 },
];

helpConfig.actions = { ...helpConfig.actions, create: true, edit: true, delete: true };
helpConfig.form = [
  { key: "category", label: { ar: "الفئة", en: "Category" }, type: "select", required: true, defaultValue: "guide", options: [
    { value: "guide", label: { ar: "دليل", en: "Guide" } },
    { value: "faq", label: { ar: "أسئلة شائعة", en: "FAQ" } },
    { value: "video", label: { ar: "فيديو", en: "Video" } },
    { value: "release", label: { ar: "تحديثات", en: "Release notes" } },
  ]},
  { key: "title_ar", label: { ar: "العنوان (AR)", en: "Title (AR)" }, type: "text", required: true },
  { key: "title_en", label: { ar: "العنوان (EN)", en: "Title (EN)" }, type: "text", required: true },
  { key: "video_url", label: { ar: "رابط الفيديو", en: "Video URL" }, type: "url" },
  { key: "external_url", label: { ar: "رابط خارجي", en: "External URL" }, type: "url" },
  { key: "sort_order", label: { ar: "الترتيب", en: "Sort order" }, type: "number", min: 0, defaultValue: 0 },
  { key: "is_published", label: { ar: "منشور", en: "Published" }, type: "boolean", defaultValue: true },
  { key: "body_ar", label: { ar: "المحتوى (AR)", en: "Body (AR)" }, type: "textarea", rows: 8 },
  { key: "body_en", label: { ar: "المحتوى (EN)", en: "Body (EN)" }, type: "textarea", rows: 8 },
];

errorLogsConfig.actions = { ...errorLogsConfig.actions, edit: true, delete: true };
errorLogsConfig.form = [
  { key: "resolved", label: { ar: "محلول", en: "Resolved" }, type: "boolean" },
  { key: "severity", label: { ar: "الشدة", en: "Severity" }, type: "select", options: [
    { value: "info", label: { ar: "معلومة", en: "Info" } },
    { value: "warning", label: { ar: "تحذير", en: "Warning" } },
    { value: "error", label: { ar: "خطأ", en: "Error" } },
    { value: "critical", label: { ar: "حرج", en: "Critical" } },
  ]},
];
