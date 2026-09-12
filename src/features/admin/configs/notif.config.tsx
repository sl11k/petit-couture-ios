import type { AdminPageConfig } from "@/features/admin/types";

const yesNo = [
  { value: "true", label: { ar: "نعم", en: "Yes" } },
  { value: "false", label: { ar: "لا", en: "No" } },
];

const audienceOptions = [
  { value: "customer", label: { ar: "عميل", en: "Customer" } },
  { value: "admin", label: { ar: "إداري", en: "Admin" } },
  { value: "both", label: { ar: "كلاهما", en: "Both" } },
];

const channelOptions = [
  { value: "whatsapp", label: { ar: "واتساب", en: "WhatsApp" } },
  { value: "sms", label: { ar: "SMS", en: "SMS" } },
  { value: "email", label: { ar: "بريد", en: "Email" } },
];

const languageOptions = [
  { value: "ar", label: { ar: "العربية", en: "Arabic" } },
  { value: "en", label: { ar: "الإنجليزية", en: "English" } },
];

const priorityOptions = [
  { value: "1", label: { ar: "عاجل جداً", en: "Critical" } },
  { value: "3", label: { ar: "مرتفع", en: "High" } },
  { value: "5", label: { ar: "عادي", en: "Normal" } },
  { value: "8", label: { ar: "منخفض", en: "Low" } },
];

const categoryOptions = [
  { value: "orders", label: { ar: "الطلبات", en: "Orders" } },
  { value: "payments", label: { ar: "المدفوعات", en: "Payments" } },
  { value: "account", label: { ar: "الحساب", en: "Account" } },
  { value: "inventory", label: { ar: "المخزون", en: "Inventory" } },
  { value: "marketing", label: { ar: "التسويق", en: "Marketing" } },
  { value: "security", label: { ar: "الأمان", en: "Security" } },
  { value: "custom", label: { ar: "مخصص", en: "Custom" } },
];

// ───────── Event types ─────────
export const notifEventTypesConfig: AdminPageConfig = {
  title: { ar: "أنواع الأحداث", en: "Event Types" },
  description: {
    ar: "أحداث النظام التي تُطلق الإشعارات (طلبات، مدفوعات، مخزون…)",
    en: "System events that trigger notifications (orders, payments, inventory…)",
  },
  table: "notif_event_types",
  orderBy: { column: "category", ascending: true },
  pageSize: 100,
  columns: [
    { key: "code", label: { ar: "الرمز", en: "Code" } },
    { key: "name_ar", label: { ar: "الاسم (ع)", en: "Name (AR)" } },
    { key: "name_en", label: { ar: "الاسم (إ)", en: "Name (EN)" }, hideOnMobile: true },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "badge" },
    { key: "category", label: { ar: "الفئة", en: "Category" }, type: "badge", hideOnMobile: true },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "number", hideOnMobile: true },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["code", "name_ar", "name_en"] },
    { key: "category", type: "select", label: { ar: "الفئة", en: "Category" }, options: categoryOptions },
    { key: "audience", type: "select", label: { ar: "الجمهور", en: "Audience" }, options: audienceOptions },
    { key: "is_enabled", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "code", label: { ar: "الرمز", en: "Code" }, type: "text", required: true, createOnly: true },
    { key: "name_ar", label: { ar: "الاسم بالعربية", en: "Name (AR)" }, type: "text", required: true },
    { key: "name_en", label: { ar: "الاسم بالإنجليزية", en: "Name (EN)" }, type: "text", required: true },
    { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 2 },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "select", options: audienceOptions, defaultValue: "customer" },
    { key: "category", label: { ar: "الفئة", en: "Category" }, type: "select", options: categoryOptions, defaultValue: "orders" },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "select", options: priorityOptions, defaultValue: "5" },
    { key: "delay_seconds", label: { ar: "تأخير (ثواني)", en: "Delay (seconds)" }, type: "number", min: 0, defaultValue: 0 },
    { key: "duplicate_window_seconds", label: { ar: "نافذة منع التكرار (ثواني)", en: "Dedupe window (seconds)" }, type: "number", min: 0, defaultValue: 60 },
    { key: "respect_working_hours", label: { ar: "احترام ساعات العمل", en: "Respect working hours" }, type: "boolean", defaultValue: false },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Templates ─────────
export const notifTemplatesConfig: AdminPageConfig = {
  title: { ar: "قوالب الإشعارات", en: "Notification Templates" },
  description: {
    ar: "قوالب الرسائل مع دعم المتغيرات {{order_number}} والأقسام الشرطية",
    en: "Message templates supporting {{variable}} and {{#var}}...{{/var}} sections",
  },
  table: "notif_templates",
  orderBy: { column: "event_code", ascending: true },
  pageSize: 100,
  columns: [
    { key: "event_code", label: { ar: "الحدث", en: "Event" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "badge" },
    { key: "language", label: { ar: "اللغة", en: "Language" }, type: "badge" },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean" },
    { key: "version", label: { ar: "النسخة", en: "Version" }, type: "number", hideOnMobile: true },
    { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["event_code", "subject", "body"] },
    { key: "channel", type: "select", label: { ar: "القناة", en: "Channel" }, options: channelOptions },
    { key: "audience", type: "select", label: { ar: "الجمهور", en: "Audience" }, options: audienceOptions },
    { key: "language", type: "select", label: { ar: "اللغة", en: "Language" }, options: languageOptions },
    { key: "is_enabled", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    {
      key: "event_code",
      label: { ar: "رمز الحدث", en: "Event code" },
      type: "lookup",
      required: true,
      lookup: {
        table: "notif_event_types",
        labelColumns: ["name_ar", "name_en"],
        secondaryColumn: "code",
        searchColumns: ["code", "name_ar", "name_en"],
        limit: 200,
      },
      helpText: { ar: "اختر الحدث الذي يُطلق هذا القالب", en: "Pick the triggering event" },
    },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "select", options: channelOptions, defaultValue: "whatsapp" },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "select", options: audienceOptions, defaultValue: "customer" },
    { key: "language", label: { ar: "اللغة", en: "Language" }, type: "select", options: languageOptions, defaultValue: "ar" },
    { key: "subject", label: { ar: "العنوان (اختياري)", en: "Subject (optional)" }, type: "text", maxLength: 200 },
    {
      key: "body",
      label: { ar: "نص الرسالة", en: "Message body" },
      type: "textarea",
      required: true,
      rows: 10,
      helpText: {
        ar: "المتغيرات: {{order_number}} {{customer_name}} {{order_total}} {{currency}} — استخدم {{#var}}...{{/var}} للأقسام الشرطية",
        en: "Variables: {{order_number}} {{customer_name}} {{order_total}} {{currency}} — use {{#var}}...{{/var}} for conditional blocks",
      },
      fullWidth: true,
    },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean", defaultValue: true },
    { key: "is_default", label: { ar: "افتراضي", en: "Default" }, type: "boolean", defaultValue: false },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Queue ─────────
export const notifQueueConfig: AdminPageConfig = {
  title: { ar: "قائمة الإرسال", en: "Notification Queue" },
  description: {
    ar: "الرسائل في الانتظار للإرسال — تعمل تلقائياً كل دقيقة",
    en: "Queued notifications — processed automatically every minute",
  },
  table: "notif_queue",
  orderBy: { column: "created_at", ascending: false },
  pageSize: 50,
  columns: [
    { key: "event_code", label: { ar: "الحدث", en: "Event" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "badge", hideOnMobile: true },
    { key: "recipient_phone", label: { ar: "المستلم", en: "Recipient" } },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "attempts", label: { ar: "المحاولات", en: "Attempts" }, type: "number", hideOnMobile: true },
    { key: "scheduled_at", label: { ar: "الموعد", en: "Scheduled" }, type: "datetime", hideOnMobile: true },
    { key: "last_error", label: { ar: "الخطأ", en: "Error" }, hideOnMobile: true },
    { key: "error_code", label: { ar: "رمز الخطأ", en: "Error code" }, hideOnMobile: true },
    { key: "provider_message_id", label: { ar: "معرّف المزود", en: "Provider message ID" }, hideOnMobile: true },
    { key: "delivered_at", label: { ar: "تم التسليم", en: "Delivered" }, type: "datetime", hideOnMobile: true },
    { key: "read_at", label: { ar: "تمت القراءة", en: "Read" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["event_code", "recipient_phone"] },
    {
      key: "status",
      type: "select",
      label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "queued", label: { ar: "بانتظار", en: "Queued" } },
        { value: "sending", label: { ar: "قيد الإرسال", en: "Sending" } },
        { value: "sent", label: { ar: "قبِلها المزود", en: "Provider accepted" } },
        { value: "delivered", label: { ar: "تم التسليم", en: "Delivered" } },
        { value: "read", label: { ar: "تمت القراءة", en: "Read" } },
        { value: "failed", label: { ar: "فشلت", en: "Failed" } },
        { value: "dead_letter", label: { ar: "فشل نهائي", en: "Final failure" } },
        { value: "sent_unconfirmed", label: { ar: "إرسال قديم غير مؤكد", en: "Historical unconfirmed" } },
        { value: "manual_link", label: { ar: "رابط يدوي", en: "Manual link" } },
      ],
    },
    { key: "channel", type: "select", label: { ar: "القناة", en: "Channel" }, options: channelOptions },
  ],
  actions: { create: false, edit: false, delete: true, export: true },
};

// ───────── Delivery logs ─────────
export const notifDeliveryLogsConfig: AdminPageConfig = {
  title: { ar: "سجل الإرسال", en: "Delivery Logs" },
  description: {
    ar: "سجل كامل لكل رسالة مُرسلة أو فاشلة",
    en: "Full log of every dispatched or failed message",
  },
  table: "notif_delivery_logs",
  orderBy: { column: "created_at", ascending: false },
  pageSize: 50,
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "When" }, type: "datetime" },
    { key: "event_code", label: { ar: "الحدث", en: "Event" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "recipient_phone", label: { ar: "المستلم", en: "Recipient" } },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "http_status", label: { ar: "HTTP", en: "HTTP" }, type: "number", hideOnMobile: true },
    { key: "duration_ms", label: { ar: "المدة (ms)", en: "Duration (ms)" }, type: "number", hideOnMobile: true },
    { key: "attempt", label: { ar: "المحاولة", en: "Attempt" }, type: "number", hideOnMobile: true },
    { key: "error_message", label: { ar: "الخطأ", en: "Error" }, hideOnMobile: true },
    { key: "error_code", label: { ar: "رمز الخطأ", en: "Error code" }, hideOnMobile: true },
    { key: "provider_message_id", label: { ar: "معرّف المزود", en: "Provider message ID" }, hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["event_code", "recipient_phone", "error_message"] },
    {
      key: "status",
      type: "select",
      label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "sent", label: { ar: "مُرسلة", en: "Sent" } },
        { value: "delivered", label: { ar: "تم التسليم", en: "Delivered" } },
        { value: "read", label: { ar: "تمت القراءة", en: "Read" } },
        { value: "failed", label: { ar: "فشلت", en: "Failed" } },
        { value: "dead_letter", label: { ar: "فشل نهائي", en: "Final failure" } },
        { value: "sent_unconfirmed", label: { ar: "غير مؤكد تاريخياً", en: "Historical unconfirmed" } },
        { value: "manual_link", label: { ar: "رابط يدوي", en: "Manual link" } },
      ],
    },
    { key: "channel", type: "select", label: { ar: "القناة", en: "Channel" }, options: channelOptions },
  ],
  actions: { create: false, edit: false, delete: false, export: true },
};

// ───────── Admin recipients ─────────
export const notifAdminRecipientsConfig: AdminPageConfig = {
  title: { ar: "مستلمو إشعارات الإدارة", en: "Admin Recipients" },
  description: {
    ar: "أرقام واتساب/إيميلات تصلها إشعارات النظام والطلبات",
    en: "WhatsApp numbers / emails that receive system and order notifications",
  },
  table: "notif_admin_recipients",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "label", label: { ar: "الاسم", en: "Label" } },
    { key: "phone", label: { ar: "الجوال", en: "Phone" } },
    { key: "email", label: { ar: "البريد", en: "Email" }, hideOnMobile: true },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["label", "phone", "email"] },
    { key: "is_enabled", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "label", label: { ar: "الاسم/الوصف", en: "Label" }, type: "text", maxLength: 100 },
    {
      key: "phone",
      label: { ar: "رقم الجوال (E.164)", en: "Phone (E.164)" },
      type: "tel",
      required: true,
      placeholder: { ar: "9665XXXXXXXX", en: "9665XXXXXXXX" },
    },
    { key: "email", label: { ar: "البريد (اختياري)", en: "Email (optional)" }, type: "email" },
    {
      key: "events",
      label: { ar: "الأحداث (اتركه فارغاً لكل الأحداث)", en: "Events (empty = all)" },
      type: "json",
      helpText: {
        ar: 'مثال: ["order.created","inventory.low_stock"]',
        en: 'e.g. ["order.created","inventory.low_stock"]',
      },
    },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Analytics ─────────
export const notifAnalyticsConfig: AdminPageConfig = {
  title: { ar: "إحصائيات الإشعارات", en: "Notification Analytics" },
  description: {
    ar: "أعداد الرسائل المُرسلة والفاشلة يومياً حسب الحدث",
    en: "Daily sent/failed counts per event",
  },
  table: "notif_analytics_daily",
  orderBy: { column: "day", ascending: false },
  pageSize: 50,
  columns: [
    { key: "day", label: { ar: "التاريخ", en: "Day" }, type: "date" },
    { key: "event_code", label: { ar: "الحدث", en: "Event" } },
    { key: "sent_count", label: { ar: "مُرسلة", en: "Sent" }, type: "number" },
    { key: "failed_count", label: { ar: "فشلت", en: "Failed" }, type: "number" },
    { key: "avg_duration_ms", label: { ar: "متوسط ms", en: "Avg ms" }, type: "number", hideOnMobile: true },
  ],
  filters: [{ key: "search", type: "search", columns: ["event_code"] }],
  actions: { create: false, edit: false, delete: false, export: true },
};

// ───────── Broadcast jobs ─────────
export const notifBroadcastConfig: AdminPageConfig = {
  title: { ar: "الحملات الجماعية", en: "Broadcast Campaigns" },
  description: {
    ar: "أنشئ حملة واتساب جماعية لعملاء مختارين",
    en: "Send bulk WhatsApp campaigns to filtered customers",
  },
  table: "notif_broadcast_jobs",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "total_recipients", label: { ar: "المستلمون", en: "Recipients" }, type: "number" },
    { key: "sent_count", label: { ar: "أُرسلت", en: "Sent" }, type: "number" },
    { key: "failed_count", label: { ar: "فشلت", en: "Failed" }, type: "number" },
    { key: "scheduled_at", label: { ar: "الموعد", en: "Scheduled" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name"] },
    {
      key: "status",
      type: "select",
      label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "draft", label: { ar: "مسودة", en: "Draft" } },
        { value: "scheduled", label: { ar: "مجدولة", en: "Scheduled" } },
        { value: "running", label: { ar: "قيد الإرسال", en: "Running" } },
        { value: "completed", label: { ar: "مكتملة", en: "Completed" } },
        { value: "cancelled", label: { ar: "ملغاة", en: "Cancelled" } },
      ],
    },
  ],
  form: [
    { key: "name", label: { ar: "اسم الحملة", en: "Campaign name" }, type: "text", required: true, maxLength: 120 },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "select", options: channelOptions, defaultValue: "whatsapp" },
    {
      key: "template_body",
      label: { ar: "نص الرسالة", en: "Message body" },
      type: "textarea",
      required: true,
      rows: 8,
      fullWidth: true,
      helpText: {
        ar: "متغيرات مسموحة: {{customer_name}}",
        en: "Supported variables: {{customer_name}}",
      },
    },
    {
      key: "audience_filter",
      label: { ar: "فلترة الجمهور (JSON)", en: "Audience filter (JSON)" },
      type: "json",
      helpText: {
        ar: 'مثال: {"has_orders": true, "min_orders": 1}',
        en: 'e.g. {"has_orders": true, "min_orders": 1}',
      },
    },
    { key: "scheduled_at", label: { ar: "موعد الإرسال (اختياري)", en: "Scheduled at (optional)" }, type: "datetime" },
    {
      key: "status",
      label: { ar: "الحالة", en: "Status" },
      type: "select",
      options: [
        { value: "draft", label: { ar: "مسودة", en: "Draft" } },
        { value: "scheduled", label: { ar: "مجدولة", en: "Scheduled" } },
        { value: "cancelled", label: { ar: "ملغاة", en: "Cancelled" } },
      ],
      defaultValue: "draft",
    },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Providers list ─────────
export const notifProvidersConfig: AdminPageConfig = {
  title: { ar: "مزودو الإشعارات", en: "Notification Providers" },
  description: {
    ar: "المزودون المتاحون — اضبط بيانات الاعتماد من مركز الإشعارات",
    en: "Available providers — configure credentials in the Notifications Center",
  },
  table: "notif_providers",
  orderBy: { column: "priority", ascending: true },
  columns: [
    { key: "code", label: { ar: "الرمز", en: "Code" } },
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean" },
    { key: "is_default", label: { ar: "افتراضي", en: "Default" }, type: "boolean" },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "number", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["code", "name"] },
    { key: "channel", type: "select", label: { ar: "القناة", en: "Channel" }, options: channelOptions },
  ],
  form: [
    { key: "code", label: { ar: "الرمز", en: "Code" }, type: "text", required: true, createOnly: true },
    { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "select", options: channelOptions, defaultValue: "whatsapp" },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "number", min: 1, defaultValue: 100 },
    { key: "is_enabled", label: { ar: "مفعل", en: "Enabled" }, type: "boolean", defaultValue: false },
    { key: "is_default", label: { ar: "افتراضي", en: "Default" }, type: "boolean", defaultValue: false },
    { key: "notes", label: { ar: "ملاحظات", en: "Notes" }, type: "textarea", rows: 2 },
  ],
  actions: { create: false, edit: true, delete: false, export: true },
};
