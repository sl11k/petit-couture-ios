import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "auth.login" | "auth.logout" | "auth.login_failed"
  | "order.create" | "order.update" | "order.status_change" | "order.cancel" | "order.refund"
  | "order.manual_discount"
  | "product.create" | "product.update" | "product.delete"
  | "product.price_change" | "product.stock_change"
  | "inventory.adjust" | "customer.update" | "customer.export"
  | "coupon.create" | "coupon.update" | "coupon.delete"
  | "user.role_grant" | "user.role_revoke" | "user.invite"
  | "permission.grant" | "permission.revoke"
  | "settings.payment" | "settings.shipping" | "settings.theme"
  | "integration.connect" | "integration.disconnect" | "integration.failure"
  | "message.sent" | "report.export" | "data.export"
  | string;

export interface AuditEntry {
  action: AuditAction;
  entity?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any>;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
}

/**
 * Record an immutable audit log entry. Best-effort — never throws to caller.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ip: string | null = null;
    const ua: string | null = typeof navigator !== "undefined" ? navigator.userAgent : null;

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entity_id ?? null,
      metadata: entry.metadata ?? {},
      old_data: entry.old_data ?? null,
      new_data: entry.new_data ?? null,
      ip_address: ip,
      user_agent: ua,
    });
  } catch (err) {
    console.warn("[audit] failed", err);
  }
}

/** Log an integration failure (external API error, webhook reject, etc). */
export async function logIntegrationFailure(provider: string, reason: string, payload?: any) {
  return logAudit({
    action: "integration.failure",
    entity: "integration",
    entity_id: provider,
    metadata: { reason, payload: payload ?? null },
  });
}

/** Log a customer-facing message sent (email/SMS/WhatsApp/notification). */
export async function logMessageSent(opts: {
  channel: "email" | "sms" | "whatsapp" | "push";
  recipient: string;
  template?: string;
  subject?: string;
  related_entity?: string;
  related_id?: string;
}) {
  return logAudit({
    action: "message.sent",
    entity: opts.related_entity ?? "message",
    entity_id: opts.related_id ?? opts.recipient,
    metadata: { channel: opts.channel, recipient: opts.recipient, template: opts.template, subject: opts.subject },
  });
}

/** Log a data export (CSV/PDF/Excel). */
export async function logDataExport(opts: { kind: string; rows: number; filters?: any }) {
  return logAudit({
    action: "data.export",
    entity: opts.kind,
    metadata: { rows: opts.rows, filters: opts.filters ?? null },
  });
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "مسؤول أعلى",
  admin: "مسؤول",
  store_manager: "مدير المتجر",
  orders_manager: "مدير الطلبات",
  support: "دعم العملاء",
  inventory_manager: "مدير المخزون",
  marketing_manager: "مدير التسويق",
  finance_manager: "مدير مالي",
  content_manager: "مدير المحتوى",
  developer: "مطوّر / تقني",
  manager: "مدير (قديم)",
  staff: "موظف",
  viewer: "مشاهد",
  customer: "عميل",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "كامل الصلاحيات بدون قيود",
  admin: "كامل الصلاحيات + إدارة المستخدمين",
  store_manager: "إدارة المتجر بالكامل عدا المستخدمين والإعدادات الحساسة",
  orders_manager: "إدارة الطلبات والمرتجعات والاستردادات",
  support: "دعم العملاء + قراءة وتعديل الطلبات",
  inventory_manager: "إدارة المنتجات والمخزون فقط",
  marketing_manager: "كوبونات + واجهات + تقارير العملاء",
  finance_manager: "البيانات المالية + إعدادات الدفع/الشحن + الفواتير",
  content_manager: "إدارة الواجهات والمحتوى",
  developer: "التكاملات + سجل العمليات + التقارير الفنية",
  viewer: "قراءة فقط (تقارير وعملاء وطلبات)",
  customer: "عميل عادي بلا صلاحيات إدارية",
};

export const PERMISSION_GROUPS: { label: string; perms: { key: string; label: string }[] }[] = [
  {
    label: "الطلبات",
    perms: [
      { key: "orders.view", label: "عرض الطلبات" },
      { key: "orders.edit", label: "تعديل الطلبات" },
      { key: "orders.cancel", label: "إلغاء الطلبات" },
      { key: "orders.refund", label: "تنفيذ Refund" },
      { key: "orders.create_manual", label: "إنشاء طلب يدوي" },
      { key: "orders.manual_discount", label: "خصم يدوي" },
    ],
  },
  {
    label: "المنتجات والمخزون",
    perms: [
      { key: "products.manage", label: "إدارة المنتجات" },
      { key: "inventory.manage", label: "إدارة المخزون" },
    ],
  },
  {
    label: "العملاء",
    perms: [
      { key: "customers.view", label: "عرض العملاء" },
      { key: "customers.manage", label: "إدارة العملاء" },
      { key: "customers.export", label: "تصدير بيانات العملاء" },
    ],
  },
  {
    label: "التسويق",
    perms: [
      { key: "coupons.manage", label: "إدارة الكوبونات" },
      { key: "storefront.manage", label: "إدارة الواجهات" },
    ],
  },
  {
    label: "المالية",
    perms: [
      { key: "finance.view", label: "عرض البيانات المالية" },
      { key: "finance.payment_settings", label: "إعدادات الدفع" },
      { key: "finance.shipping_settings", label: "إعدادات الشحن" },
      { key: "invoices.manage", label: "إدارة الفواتير" },
    ],
  },
  {
    label: "النظام",
    perms: [
      { key: "reports.view", label: "إدارة التقارير" },
      { key: "integrations.manage", label: "إدارة التكاملات" },
      { key: "users.manage", label: "إدارة المستخدمين" },
      { key: "audit.view", label: "عرض سجل العمليات" },
      { key: "returns.manage", label: "إدارة المرتجعات" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms.map((p) => p.key));
