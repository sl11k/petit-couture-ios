import type { AdminDetailConfig, FormFieldDef } from "../types";

// ----- Coupons -----
const couponForm: FormFieldDef[] = [
  { key: "code", label: { ar: "الكود", en: "Code" }, type: "text", required: true, maxLength: 50 },
  { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text" },
  { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 2 },
  { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  { key: "discount_type", label: { ar: "نوع الخصم", en: "Discount type" }, type: "select", required: true, defaultValue: "percent", options: [
    { value: "percent", label: { ar: "نسبة %", en: "Percent" } },
    { value: "fixed", label: { ar: "مبلغ ثابت", en: "Fixed amount" } },
    { value: "free_shipping", label: { ar: "شحن مجاني", en: "Free shipping" } },
  ]},
  { key: "discount_value", label: { ar: "قيمة الخصم", en: "Discount value" }, type: "number", required: true, min: 0 },
  { key: "min_subtotal", label: { ar: "حد أدنى للإجمالي", en: "Min subtotal" }, type: "number", min: 0 },
  { key: "max_uses", label: { ar: "أقصى استخدام", en: "Max uses" }, type: "number", min: 1 },
  { key: "per_customer_limit", label: { ar: "حد للعميل", en: "Per-customer limit" }, type: "number", min: 1 },
  { key: "first_order_only", label: { ar: "أول طلب فقط", en: "First order only" }, type: "boolean" },
  { key: "starts_at", label: { ar: "يبدأ", en: "Starts at" }, type: "datetime" },
  { key: "expires_at", label: { ar: "ينتهي", en: "Expires at" }, type: "datetime" },
];

export const couponDetailConfig: AdminDetailConfig = {
  table: "coupons",
  backTo: "/admin/coupons",
  backLabel: { ar: "الكوبونات", en: "Coupons" },
  title: (r) => r.code ?? "",
  description: (r) => ({ ar: r.name ?? "", en: r.name ?? "" }),
  editForm: couponForm,
  sections: [
    {
      title: { ar: "الأساسيات", en: "Basics" },
      fields: [
        { key: "code", label: { ar: "الكود", en: "Code" } },
        { key: "name", label: { ar: "الاسم", en: "Name" } },
        { key: "is_active", label: { ar: "الحالة", en: "Status" }, type: "boolean" },
        { key: "discount_type", label: { ar: "النوع", en: "Type" }, type: "badge" },
        { key: "discount_value", label: { ar: "القيمة", en: "Value" }, type: "number" },
        { key: "min_subtotal", label: { ar: "حد أدنى", en: "Min subtotal" }, type: "currency" },
        { key: "description", label: { ar: "الوصف", en: "Description" }, type: "longtext", hideIfEmpty: true, span: 2 },
      ],
    },
    {
      title: { ar: "الحدود والمدة", en: "Limits & schedule" },
      fields: [
        { key: "max_uses", label: { ar: "أقصى استخدام", en: "Max uses" }, type: "number" },
        { key: "used_count", label: { ar: "مستخدم", en: "Used" }, type: "number" },
        { key: "per_customer_limit", label: { ar: "حد للعميل", en: "Per customer" }, type: "number" },
        { key: "first_order_only", label: { ar: "أول طلب فقط", en: "First order only" }, type: "boolean" },
        { key: "starts_at", label: { ar: "يبدأ", en: "Starts at" }, type: "datetime" },
        { key: "expires_at", label: { ar: "ينتهي", en: "Ends at" }, type: "datetime" },
      ],
    },
    {
      title: { ar: "إحصاءات", en: "Stats" },
      sidebar: true,
      columns: 1,
      fields: [
        { key: "used_count", label: { ar: "مرات الاستخدام", en: "Uses" }, type: "number" },
        { key: "created_at", label: { ar: "أُنشئ", en: "Created" }, type: "datetime" },
        { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime" },
      ],
    },
  ],
};

// ----- Marketing Campaigns -----
const campaignForm: FormFieldDef[] = [
  { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true },
  { key: "campaign_type", label: { ar: "النوع", en: "Type" }, type: "select", required: true, options: [
    { value: "banner", label: { ar: "بانر", en: "Banner" } },
    { value: "email", label: { ar: "بريد", en: "Email" } },
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
  { key: "target_audience", label: { ar: "الجمهور", en: "Audience" }, type: "text" },
  { key: "coupon_code", label: { ar: "الكوبون", en: "Coupon code" }, type: "text" },
  { key: "starts_at", label: { ar: "يبدأ", en: "Starts at" }, type: "datetime" },
  { key: "ends_at", label: { ar: "ينتهي", en: "Ends at" }, type: "datetime" },
  { key: "email_subject", label: { ar: "موضوع البريد", en: "Email subject" }, type: "text" },
  { key: "email_body", label: { ar: "نص الرسالة", en: "Body" }, type: "textarea", rows: 6 },
  { key: "banner_image_url", label: { ar: "صورة البانر", en: "Banner image" }, type: "url" },
  { key: "banner_link_url", label: { ar: "رابط البانر", en: "Banner link" }, type: "url" },
];

export const campaignDetailConfig: AdminDetailConfig = {
  table: "marketing_campaigns",
  backTo: "/admin/campaigns",
  backLabel: { ar: "الحملات", en: "Campaigns" },
  title: (r) => r.name ?? "",
  description: (r) => ({ ar: r.status ?? "", en: r.status ?? "" }),
  editForm: campaignForm,
  sections: [
    {
      title: { ar: "الأساسيات", en: "Basics" },
      fields: [
        { key: "name", label: { ar: "الاسم", en: "Name" } },
        { key: "campaign_type", label: { ar: "النوع", en: "Type" }, type: "badge" },
        { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
        { key: "target_audience", label: { ar: "الجمهور", en: "Audience" } },
        { key: "coupon_code", label: { ar: "الكوبون", en: "Coupon" }, hideIfEmpty: true },
        { key: "starts_at", label: { ar: "يبدأ", en: "Starts" }, type: "datetime" },
        { key: "ends_at", label: { ar: "ينتهي", en: "Ends" }, type: "datetime" },
      ],
    },
    {
      title: { ar: "المحتوى", en: "Content" },
      columns: 1,
      fields: [
        { key: "email_subject", label: { ar: "موضوع البريد", en: "Email subject" }, hideIfEmpty: true },
        { key: "email_body", label: { ar: "النص", en: "Body" }, type: "longtext", hideIfEmpty: true },
        { key: "banner_image_url", label: { ar: "صورة البانر", en: "Banner image" }, type: "image", hideIfEmpty: true },
        { key: "banner_link_url", label: { ar: "رابط البانر", en: "Banner link" }, type: "url", hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "الأداء", en: "Performance" },
      sidebar: true,
      columns: 1,
      fields: [
        { key: "sent_count", label: { ar: "أُرسل", en: "Sent" }, type: "number" },
        { key: "open_count", label: { ar: "فُتح", en: "Opens" }, type: "number" },
        { key: "click_count", label: { ar: "نقرات", en: "Clicks" }, type: "number" },
        { key: "conversion_count", label: { ar: "تحويلات", en: "Conversions" }, type: "number" },
        { key: "revenue_attributed", label: { ar: "الإيرادات", en: "Revenue" }, type: "currency" },
        {
          key: "ctr",
          label: { ar: "CTR", en: "CTR" },
          render: (_v, r) =>
            r.sent_count ? `${((r.click_count / r.sent_count) * 100).toFixed(1)}%` : "—",
        },
        {
          key: "cr",
          label: { ar: "CR", en: "CR" },
          render: (_v, r) =>
            r.click_count ? `${((r.conversion_count / r.click_count) * 100).toFixed(1)}%` : "—",
        },
      ],
    },
  ],
};

// ----- Landing Pages -----
const landingForm: FormFieldDef[] = [
  { key: "title", label: { ar: "العنوان", en: "Title" }, type: "text", required: true },
  { key: "slug", label: { ar: "المسار", en: "Slug" }, type: "text", required: true, pattern: "^[a-z0-9-]+$" },
  { key: "subtitle", label: { ar: "العنوان الفرعي", en: "Subtitle" }, type: "text" },
  { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 3 },
  { key: "hero_image", label: { ar: "صورة الغلاف", en: "Hero image" }, type: "url" },
  { key: "cta_text", label: { ar: "نص الزر", en: "CTA text" }, type: "text" },
  { key: "cta_url", label: { ar: "رابط الزر", en: "CTA URL" }, type: "url" },
  { key: "coupon_code", label: { ar: "كوبون", en: "Coupon code" }, type: "text" },
  { key: "utm_campaign", label: { ar: "UTM Campaign", en: "UTM Campaign" }, type: "text" },
  { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean", defaultValue: true },
  { key: "show_as_collection", label: { ar: "عرض كمجموعة", en: "Show as collection" }, type: "boolean" },
];

export const landingDetailConfig: AdminDetailConfig = {
  table: "landing_pages",
  backTo: "/admin/landing-pages",
  backLabel: { ar: "صفحات الهبوط", en: "Landing Pages" },
  title: (r) => r.title ?? "",
  description: (r) => ({ ar: `/${r.slug}`, en: `/${r.slug}` }),
  editForm: landingForm,
  sections: [
    {
      title: { ar: "المحتوى", en: "Content" },
      fields: [
        { key: "title", label: { ar: "العنوان", en: "Title" } },
        { key: "slug", label: { ar: "المسار", en: "Slug" } },
        { key: "subtitle", label: { ar: "العنوان الفرعي", en: "Subtitle" }, hideIfEmpty: true },
        { key: "is_active", label: { ar: "الحالة", en: "Active" }, type: "boolean" },
        { key: "description", label: { ar: "الوصف", en: "Description" }, type: "longtext", hideIfEmpty: true, span: 2 },
        { key: "hero_image", label: { ar: "الغلاف", en: "Hero image" }, type: "image", hideIfEmpty: true, span: 2 },
      ],
    },
    {
      title: { ar: "الدعوة للإجراء", en: "Call to action" },
      fields: [
        { key: "cta_text", label: { ar: "نص الزر", en: "CTA text" }, hideIfEmpty: true },
        { key: "cta_url", label: { ar: "الرابط", en: "URL" }, type: "url", hideIfEmpty: true },
        { key: "coupon_code", label: { ar: "كوبون", en: "Coupon" }, hideIfEmpty: true },
        { key: "utm_campaign", label: { ar: "UTM", en: "UTM" }, hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "إحصاءات", en: "Stats" },
      sidebar: true,
      columns: 1,
      fields: [
        { key: "views", label: { ar: "المشاهدات", en: "Views" }, type: "number" },
        {
          key: "preview",
          label: { ar: "معاينة", en: "Preview" },
          render: (_v, r) => (
            <a href={`/lp/${r.slug}`} target="_blank" rel="noreferrer" className="text-primary underline">
              /lp/{r.slug}
            </a>
          ),
        },
        { key: "created_at", label: { ar: "أُنشئت", en: "Created" }, type: "datetime" },
        { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime" },
      ],
    },
  ],
};

// ----- Integrations -----
const integrationForm: FormFieldDef[] = [
  { key: "category", label: { ar: "الفئة", en: "Category" }, type: "select", required: true, options: [
    { value: "payment", label: { ar: "دفع", en: "Payment" } },
    { value: "shipping", label: { ar: "شحن", en: "Shipping" } },
    { value: "messaging", label: { ar: "رسائل", en: "Messaging" } },
    { value: "analytics", label: { ar: "تحليلات", en: "Analytics" } },
  ]},
  { key: "provider", label: { ar: "المزود", en: "Provider" }, type: "text", required: true },
  { key: "display_name", label: { ar: "الاسم الظاهر", en: "Display name" }, type: "text" },
  { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
  { key: "mode", label: { ar: "الوضع", en: "Mode" }, type: "select", defaultValue: "sandbox", options: [
    { value: "sandbox", label: { ar: "تجريبي", en: "Sandbox" } },
    { value: "live", label: { ar: "إنتاج", en: "Live" } },
  ]},
  { key: "api_key", label: { ar: "API Key", en: "API Key" }, type: "text" },
  { key: "api_secret", label: { ar: "API Secret", en: "API Secret" }, type: "text" },
  { key: "webhook_url", label: { ar: "Webhook URL", en: "Webhook URL" }, type: "url" },
  { key: "webhook_secret", label: { ar: "Webhook Secret", en: "Webhook Secret" }, type: "text" },
  { key: "config", label: { ar: "إعدادات إضافية", en: "Extra config (JSON)" }, type: "json" },
];

export const integrationDetailConfig: AdminDetailConfig = {
  table: "integrations",
  backTo: "/admin/integrations",
  backLabel: { ar: "التكاملات", en: "Integrations" },
  title: (r) => r.display_name || r.provider || "",
  description: (r) => ({ ar: `${r.category} • ${r.provider}`, en: `${r.category} • ${r.provider}` }),
  editForm: integrationForm,
  sections: [
    {
      title: { ar: "الأساسيات", en: "Basics" },
      fields: [
        { key: "category", label: { ar: "الفئة", en: "Category" }, type: "badge" },
        { key: "provider", label: { ar: "المزود", en: "Provider" } },
        { key: "display_name", label: { ar: "الاسم", en: "Name" }, hideIfEmpty: true },
        { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
        { key: "mode", label: { ar: "الوضع", en: "Mode" }, type: "badge" },
      ],
    },
    {
      title: { ar: "المفاتيح", en: "Credentials" },
      fields: [
        { key: "api_key", label: { ar: "API Key", en: "API Key" }, hideIfEmpty: true },
        { key: "api_secret", label: { ar: "API Secret", en: "API Secret" }, hideIfEmpty: true,
          render: (v) => v ? <span className="font-mono">••••{String(v).slice(-4)}</span> : "—" },
        { key: "webhook_url", label: { ar: "Webhook URL", en: "Webhook URL" }, type: "url", hideIfEmpty: true, span: 2 },
        { key: "webhook_secret", label: { ar: "Webhook Secret", en: "Webhook Secret" }, hideIfEmpty: true,
          render: (v) => v ? <span className="font-mono">••••{String(v).slice(-4)}</span> : "—" },
      ],
    },
    {
      title: { ar: "إعدادات", en: "Config" },
      columns: 1,
      fields: [
        { key: "config", label: { ar: "JSON", en: "JSON" }, type: "json", hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "آخر اختبار", en: "Last test" },
      sidebar: true,
      columns: 1,
      fields: [
        { key: "last_test_ok", label: { ar: "النتيجة", en: "Result" }, type: "boolean" },
        { key: "last_test_at", label: { ar: "الوقت", en: "Time" }, type: "datetime" },
        { key: "last_test_message", label: { ar: "الرسالة", en: "Message" }, type: "longtext", hideIfEmpty: true },
      ],
    },
  ],
};

// ----- Webhooks -----
const webhookForm: FormFieldDef[] = [
  { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true },
  { key: "url", label: { ar: "العنوان", en: "URL" }, type: "url", required: true },
  { key: "secret", label: { ar: "السر", en: "Secret" }, type: "text" },
  { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean", defaultValue: true },
  { key: "events", label: { ar: "الأحداث (JSON Array)", en: "Events (JSON array)" }, type: "json", helpText: { ar: 'مثال: ["order.created"]', en: 'Example: ["order.created"]' } },
];

export const webhookDetailConfig: AdminDetailConfig = {
  table: "webhook_endpoints",
  backTo: "/admin/webhooks",
  backLabel: { ar: "Webhooks", en: "Webhooks" },
  title: (r) => r.name ?? "",
  description: (r) => ({ ar: r.url ?? "", en: r.url ?? "" }),
  editForm: webhookForm,
  sections: [
    {
      title: { ar: "الأساسيات", en: "Basics" },
      fields: [
        { key: "name", label: { ar: "الاسم", en: "Name" } },
        { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
        { key: "url", label: { ar: "العنوان", en: "URL" }, type: "url", span: 2 },
        { key: "secret", label: { ar: "السر", en: "Secret" }, hideIfEmpty: true,
          render: (v) => v ? <span className="font-mono">••••{String(v).slice(-4)}</span> : "—" },
        { key: "events", label: { ar: "الأحداث", en: "Events" }, type: "json", span: 2 },
      ],
    },
    {
      title: { ar: "حالة التسليم", en: "Delivery status" },
      sidebar: true,
      columns: 1,
      fields: [
        { key: "last_delivery_status", label: { ar: "آخر حالة HTTP", en: "Last HTTP status" }, type: "number" },
        { key: "last_delivery_at", label: { ar: "آخر تسليم", en: "Last delivery" }, type: "datetime" },
        { key: "failure_count", label: { ar: "أخطاء متتالية", en: "Failure count" }, type: "number" },
      ],
    },
  ],
  related: [
    {
      title: { ar: "آخر التسليمات", en: "Recent deliveries" },
      table: "webhook_deliveries",
      foreignKey: "endpoint_id",
      orderBy: { column: "created_at", ascending: false },
      limit: 20,
      columns: [
        { key: "event_type", label: { ar: "الحدث", en: "Event" } },
        { key: "response_status", label: { ar: "حالة", en: "Status" }, type: "number" },
        { key: "attempt_number", label: { ar: "محاولة", en: "Attempt" }, type: "number" },
        { key: "created_at", label: { ar: "وقت", en: "Time" }, type: "datetime" },
      ],
      emptyMessage: { ar: "لا تسليمات بعد", en: "No deliveries yet" },
    },
  ],
};
