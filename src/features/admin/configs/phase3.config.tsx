import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { AdminPageConfig } from "@/features/admin/types";

// Map audit entity name → admin route prefix (singular/plural variants supported)
const ENTITY_ROUTE: Record<string, string> = {
  orders: "/admin/orders",
  order: "/admin/orders",
  products: "/admin/products",
  product: "/admin/products",
  profiles: "/admin/customers",
  customer: "/admin/customers",
  user: "/admin/users",
  user_roles: "/admin/users",
  integrations: "/admin/integrations",
  integration: "/admin/integrations",
  coupons: "/admin/coupons",
  coupon: "/admin/coupons",
  marketing_campaigns: "/admin/campaigns",
  campaign: "/admin/campaigns",
  landing_pages: "/admin/landing-pages",
  webhook_endpoints: "/admin/webhooks",
  support_tickets: "/admin/support",
  site_settings: "/admin/settings",
  settings: "/admin/settings",
};

function entityHref(entity?: string | null, id?: string | null): string | null {
  if (!entity) return null;
  const base = ENTITY_ROUTE[entity];
  if (!base) return null;
  return id ? `${base}/${id}` : base;
}

export const auditLogsConfig: AdminPageConfig = {
  title: { ar: "سجل العمليات", en: "Audit Log" },
  description: {
    ar: "تتبع جميع التغييرات وروابط للكيان والمستخدم",
    en: "Track all changes with links to the related entity and user",
  },
  table: "audit_logs",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
    {
      key: "actor_email",
      label: { ar: "المستخدم", en: "Actor" },
      render: (value, row: any) => {
        if (!value) return <span className="text-muted-foreground">—</span>;
        return row.actor_id ? (
          <Link
            to="/admin/customers/$id"
            params={{ id: row.actor_id }}
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
          >
            {value}
          </Link>
        ) : (
          <span>{value}</span>
        );
      },
    },
    { key: "action", label: { ar: "الإجراء", en: "Action" }, type: "badge" },
    {
      key: "entity",
      label: { ar: "الكيان", en: "Entity" },
      hideOnMobile: true,
      render: (_v, row: any) => {
        const href = entityHref(row.entity, row.entity_id);
        if (!row.entity) return <span className="text-muted-foreground">—</span>;
        const text = row.entity_id
          ? `${row.entity} • ${String(row.entity_id).slice(0, 8)}…`
          : row.entity;
        return href ? (
          <a
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {text}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span>{text}</span>
        );
      },
    },
    { key: "ip_address", label: { ar: "IP", en: "IP" }, hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["actor_email", "action", "entity", "entity_id"] },
    {
      key: "entity",
      type: "select",
      label: { ar: "الكيان", en: "Entity" },
      options: [
        { value: "orders", label: { ar: "الطلبات", en: "Orders" } },
        { value: "products", label: { ar: "المنتجات", en: "Products" } },
        { value: "user", label: { ar: "المستخدمون", en: "Users" } },
        { value: "user_roles", label: { ar: "الأدوار", en: "Roles" } },
        { value: "integrations", label: { ar: "التكاملات", en: "Integrations" } },
        { value: "site_settings", label: { ar: "الإعدادات", en: "Settings" } },
      ],
    },
  ],
  actions: { export: true },
  rowHref: (row: any) => `/admin/audit/${row.id}`,
};

export const auditLoginsConfig: AdminPageConfig = {
  title: { ar: "محاولات تسجيل الدخول", en: "Login Attempts" },
  description: { ar: "محاولات الدخول الفاشلة", en: "Failed login attempts" },
  table: "failed_login_attempts",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
    { key: "email", label: { ar: "البريد", en: "Email" } },
    { key: "ip_address", label: { ar: "IP", en: "IP" } },
    { key: "reason", label: { ar: "السبب", en: "Reason" }, hideOnMobile: true },
    { key: "user_agent", label: { ar: "المتصفح", en: "User Agent" }, hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["email", "ip_address"] },
  ],
  actions: { export: true },
};

export const usersConfig: AdminPageConfig = {
  title: { ar: "المستخدمون والصلاحيات", en: "Users & Roles" },
  description: { ar: "إدارة أدوار المستخدمين", en: "Manage user roles" },
  table: "user_roles",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "user_id", label: { ar: "معرف المستخدم", en: "User ID" } },
    { key: "role", label: { ar: "الدور", en: "Role" }, type: "badge" },
    { key: "created_at", label: { ar: "أُضيف", en: "Added" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["user_id"] },
    {
      key: "role", type: "select", label: { ar: "الدور", en: "Role" },
      options: [
        { value: "super_admin", label: { ar: "مدير عام", en: "Super Admin" } },
        { value: "admin", label: { ar: "مدير", en: "Admin" } },
        { value: "manager", label: { ar: "مشرف", en: "Manager" } },
        { value: "staff", label: { ar: "موظف", en: "Staff" } },
        { value: "viewer", label: { ar: "مشاهد", en: "Viewer" } },
        { value: "customer", label: { ar: "عميل", en: "Customer" } },
        { value: "developer", label: { ar: "مطور", en: "Developer" } },
      ],
    },
  ],
  actions: { export: true },
};

export const notificationsConfig: AdminPageConfig = {
  title: { ar: "إشعارات المشرفين", en: "Admin Notifications" },
  table: "admin_notifications",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
    { key: "severity", label: { ar: "الشدة", en: "Severity" }, type: "badge" },
    { key: "title", label: { ar: "العنوان", en: "Title" } },
    { key: "event_code", label: { ar: "الحدث", en: "Event" }, hideOnMobile: true },
    { key: "related_entity", label: { ar: "الكيان", en: "Entity" }, hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title", "body", "event_code"] },
    {
      key: "severity", type: "select", label: { ar: "الشدة", en: "Severity" },
      options: [
        { value: "info", label: { ar: "معلومة", en: "Info" } },
        { value: "warning", label: { ar: "تحذير", en: "Warning" } },
        { value: "error", label: { ar: "خطأ", en: "Error" } },
        { value: "critical", label: { ar: "حرج", en: "Critical" } },
      ],
    },
  ],
  actions: { export: true },
};

export const messagesConfig: AdminPageConfig = {
  title: { ar: "الرسائل", en: "Messages" },
  description: { ar: "محادثات WhatsApp و SMS", en: "WhatsApp & SMS conversations" },
  table: "messaging_conversations",
  orderBy: { column: "last_message_at", ascending: false },
  columns: [
    { key: "customer_name", label: { ar: "العميل", en: "Customer" } },
    { key: "customer_phone", label: { ar: "الهاتف", en: "Phone" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "unread_count", label: { ar: "غير مقروء", en: "Unread" }, type: "number" },
    { key: "last_message_preview", label: { ar: "آخر رسالة", en: "Last message" }, hideOnMobile: true },
    { key: "last_message_at", label: { ar: "الوقت", en: "When" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["customer_name", "customer_phone"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "open", label: { ar: "مفتوحة", en: "Open" } },
        { value: "resolved", label: { ar: "محلولة", en: "Resolved" } },
        { value: "archived", label: { ar: "مؤرشفة", en: "Archived" } },
      ],
    },
    {
      key: "channel", type: "select", label: { ar: "القناة", en: "Channel" },
      options: [
        { value: "whatsapp", label: { ar: "واتساب", en: "WhatsApp" } },
        { value: "sms", label: { ar: "SMS", en: "SMS" } },
      ],
    },
  ],
};

export const supportConfig: AdminPageConfig = {
  title: { ar: "تذاكر الدعم", en: "Support Tickets" },
  table: "support_tickets",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "ticket_number", label: { ar: "رقم التذكرة", en: "Ticket #" } },
    { key: "subject", label: { ar: "الموضوع", en: "Subject" } },
    { key: "customer_email", label: { ar: "العميل", en: "Customer" }, hideOnMobile: true },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "badge" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "created_at", label: { ar: "التاريخ", en: "Created" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["ticket_number", "subject", "customer_email"] },
    {
      key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "new", label: { ar: "جديدة", en: "New" } },
        { value: "waiting_admin", label: { ar: "بانتظار الرد", en: "Waiting admin" } },
        { value: "waiting_customer", label: { ar: "بانتظار العميل", en: "Waiting customer" } },
        { value: "resolved", label: { ar: "محلولة", en: "Resolved" } },
        { value: "closed", label: { ar: "مغلقة", en: "Closed" } },
      ],
    },
    {
      key: "priority", type: "select", label: { ar: "الأولوية", en: "Priority" },
      options: [
        { value: "low", label: { ar: "منخفضة", en: "Low" } },
        { value: "normal", label: { ar: "عادية", en: "Normal" } },
        { value: "high", label: { ar: "عالية", en: "High" } },
        { value: "urgent", label: { ar: "عاجلة", en: "Urgent" } },
      ],
    },
  ],
  actions: { export: true },
};

export const integrationsConfig: AdminPageConfig = {
  title: { ar: "التكاملات", en: "Integrations" },
  description: { ar: "بوابات الدفع والشحن وغيرها", en: "Payment, shipping & other providers" },
  table: "integrations",
  orderBy: { column: "category" },
  columns: [
    { key: "category", label: { ar: "الفئة", en: "Category" }, type: "badge" },
    { key: "provider", label: { ar: "المزود", en: "Provider" } },
    { key: "display_name", label: { ar: "الاسم", en: "Display name" }, hideOnMobile: true },
    { key: "mode", label: { ar: "الوضع", en: "Mode" }, type: "badge" },
    { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
    { key: "last_test_ok", label: { ar: "آخر اختبار", en: "Last test" }, type: "boolean", hideOnMobile: true },
    { key: "last_test_at", label: { ar: "وقت الاختبار", en: "Tested at" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["provider", "display_name"] },
    {
      key: "category", type: "select", label: { ar: "الفئة", en: "Category" },
      options: [
        { value: "payment", label: { ar: "دفع", en: "Payment" } },
        { value: "shipping", label: { ar: "شحن", en: "Shipping" } },
        { value: "messaging", label: { ar: "رسائل", en: "Messaging" } },
        { value: "analytics", label: { ar: "تحليلات", en: "Analytics" } },
      ],
    },
    {
      key: "enabled", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "true", label: { ar: "مفعّل", en: "Enabled" } },
        { value: "false", label: { ar: "متوقف", en: "Disabled" } },
      ],
    },
  ],
};

export const webhooksConfig: AdminPageConfig = {
  title: { ar: "Webhooks", en: "Webhooks" },
  description: { ar: "نقاط نهاية الإشعارات الخارجية", en: "Outbound notification endpoints" },
  table: "webhook_endpoints",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "url", label: { ar: "العنوان", en: "URL" } },
    { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
    { key: "last_delivery_status", label: { ar: "آخر حالة", en: "Last status" }, type: "number", hideOnMobile: true },
    { key: "failure_count", label: { ar: "أخطاء", en: "Failures" }, type: "number" },
    { key: "last_delivery_at", label: { ar: "آخر تسليم", en: "Last delivery" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name", "url"] },
  ],
};

// Add row navigation to detail pages
supportConfig.rowHref = (row: any) => `/admin/support/${row.id}`;
messagesConfig.rowHref = (row: any) => `/admin/messages/${row.id}`;
integrationsConfig.rowHref = (row: any) => `/admin/integrations/${row.id}`;
webhooksConfig.rowHref = (row: any) => `/admin/webhooks/${row.id}`;

usersConfig.actions = { ...usersConfig.actions, create: true, edit: true, delete: true };
usersConfig.form = [
  { key: "user_id", label: { ar: "معرف المستخدم", en: "User ID" }, type: "text", required: true, createOnly: true, helpText: { ar: "معرف auth.users", en: "auth.users UUID" } },
  { key: "role", label: { ar: "الدور", en: "Role" }, type: "select", required: true, defaultValue: "customer", options: [
    { value: "super_admin", label: { ar: "مدير عام", en: "Super Admin" } },
    { value: "admin", label: { ar: "مدير", en: "Admin" } },
    { value: "manager", label: { ar: "مشرف", en: "Manager" } },
    { value: "staff", label: { ar: "موظف", en: "Staff" } },
    { value: "viewer", label: { ar: "مشاهد", en: "Viewer" } },
    { value: "customer", label: { ar: "عميل", en: "Customer" } },
    { value: "developer", label: { ar: "مطور", en: "Developer" } },
  ]},
];

notificationsConfig.actions = { ...notificationsConfig.actions, create: true, delete: true };
notificationsConfig.form = [
  { key: "title", label: { ar: "العنوان", en: "Title" }, type: "text", required: true, maxLength: 200 },
  { key: "body", label: { ar: "النص", en: "Body" }, type: "textarea", rows: 4 },
  { key: "event_code", label: { ar: "كود الحدث", en: "Event code" }, type: "text", required: true },
  { key: "severity", label: { ar: "الشدة", en: "Severity" }, type: "select", required: true, defaultValue: "info", options: [
    { value: "info", label: { ar: "معلومة", en: "Info" } },
    { value: "warning", label: { ar: "تحذير", en: "Warning" } },
    { value: "error", label: { ar: "خطأ", en: "Error" } },
    { value: "critical", label: { ar: "حرج", en: "Critical" } },
  ]},
  { key: "related_entity", label: { ar: "الكيان المرتبط", en: "Related entity" }, type: "text" },
  { key: "related_entity_id", label: { ar: "معرف الكيان", en: "Entity ID" }, type: "text" },
  { key: "link", label: { ar: "رابط", en: "Link" }, type: "url" },
];

supportConfig.actions = { ...supportConfig.actions, edit: true };
supportConfig.form = [
  { key: "subject", label: { ar: "الموضوع", en: "Subject" }, type: "text", required: true, maxLength: 200 },
  { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", required: true, options: [
    { value: "new", label: { ar: "جديدة", en: "New" } },
    { value: "waiting_admin", label: { ar: "بانتظار الرد", en: "Waiting admin" } },
    { value: "waiting_customer", label: { ar: "بانتظار العميل", en: "Waiting customer" } },
    { value: "resolved", label: { ar: "محلولة", en: "Resolved" } },
    { value: "closed", label: { ar: "مغلقة", en: "Closed" } },
  ]},
  { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "select", required: true, defaultValue: "normal", options: [
    { value: "low", label: { ar: "منخفضة", en: "Low" } },
    { value: "normal", label: { ar: "عادية", en: "Normal" } },
    { value: "high", label: { ar: "عالية", en: "High" } },
    { value: "urgent", label: { ar: "عاجلة", en: "Urgent" } },
  ]},
];

integrationsConfig.actions = { ...integrationsConfig.actions, create: true, edit: true, delete: true };
integrationsConfig.form = [
  { key: "category", label: { ar: "الفئة", en: "Category" }, type: "select", required: true, options: [
    { value: "payment", label: { ar: "دفع", en: "Payment" } },
    { value: "shipping", label: { ar: "شحن", en: "Shipping" } },
    { value: "messaging", label: { ar: "رسائل", en: "Messaging" } },
    { value: "analytics", label: { ar: "تحليلات", en: "Analytics" } },
  ]},
  { key: "provider", label: { ar: "المزود", en: "Provider" }, type: "text", required: true, maxLength: 60 },
  { key: "display_name", label: { ar: "الاسم الظاهر", en: "Display name" }, type: "text" },
  { key: "mode", label: { ar: "الوضع", en: "Mode" }, type: "select", defaultValue: "sandbox", options: [
    { value: "sandbox", label: { ar: "تجريبي", en: "Sandbox" } },
    { value: "live", label: { ar: "مباشر", en: "Live" } },
  ]},
  { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
  { key: "api_key", label: { ar: "API Key", en: "API Key" }, type: "text" },
  { key: "api_secret", label: { ar: "API Secret", en: "API Secret" }, type: "text" },
  { key: "webhook_url", label: { ar: "رابط Webhook", en: "Webhook URL" }, type: "url" },
  { key: "webhook_secret", label: { ar: "سر Webhook", en: "Webhook secret" }, type: "text" },
  { key: "config", label: { ar: "إعدادات إضافية (JSON)", en: "Extra config (JSON)" }, type: "json" },
];

webhooksConfig.actions = { ...webhooksConfig.actions, create: true, edit: true, delete: true };
webhooksConfig.form = [
  { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true, maxLength: 80 },
  { key: "url", label: { ar: "الرابط", en: "URL" }, type: "url", required: true },
  { key: "secret", label: { ar: "السر", en: "Secret" }, type: "text" },
  { key: "enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean", defaultValue: true },
  { key: "events", label: { ar: "الأحداث (JSON array)", en: "Events (JSON array)" }, type: "json", helpText: { ar: 'مثال: ["order.created","order.paid"]', en: 'e.g. ["order.created","order.paid"]' } },
];

messagesConfig.actions = { ...messagesConfig.actions, edit: true };
messagesConfig.form = [
  { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", required: true, options: [
    { value: "open", label: { ar: "مفتوحة", en: "Open" } },
    { value: "resolved", label: { ar: "محلولة", en: "Resolved" } },
    { value: "archived", label: { ar: "مؤرشفة", en: "Archived" } },
  ]},
  { key: "customer_name", label: { ar: "اسم العميل", en: "Customer name" }, type: "text" },
];
