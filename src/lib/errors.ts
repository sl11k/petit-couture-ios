/**
 * Unified error catalog & logger.
 * Each error code has: customer message (clear & friendly), admin message
 * (technical detail), suggested action, severity, and category.
 */
import { supabase } from "@/integrations/supabase/client";

// Untyped client to bypass strict type generation lag for new tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type ErrorSeverity = "info" | "warning" | "error" | "critical";
export type ErrorCategory =
  | "payment"
  | "stock"
  | "shipping"
  | "discount"
  | "location"
  | "messaging"
  | "webhook"
  | "network"
  | "checkout"
  | "system";

export interface ErrorDef {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  /** Customer-facing message (Arabic, friendly, no jargon). */
  customer: string;
  /** Internal technical description for admin/logs. */
  admin: string;
  /** What the system or operator should do. */
  action: string;
}

export const ERRORS = {
  PAYMENT_FAILED: {
    code: "PAYMENT_FAILED",
    category: "payment",
    severity: "error",
    customer: "تعذّر إتمام الدفع. لم يتم خصم أي مبلغ. يرجى المحاولة بطريقة دفع أخرى.",
    admin: "بوابة الدفع رفضت العملية أو أعادت خطأ. تحقق من سجلات البوابة وحالة المحاولة.",
    action: "احتفظ بالسلة كما هي، اعرض بدائل دفع، وأرسل تذكير إعادة محاولة بعد 30 دقيقة.",
  },
  PAYMENT_DOUBLE_CLICK: {
    code: "PAYMENT_DOUBLE_CLICK",
    category: "payment",
    severity: "warning",
    customer: "جارٍ معالجة طلبك السابق… يرجى الانتظار قبل المحاولة مرة أخرى.",
    admin: "تم استقبال نفس مفتاح Idempotency خلال أقل من دقيقة — منع إنشاء طلب مكرر.",
    action: "إرجاع نتيجة الطلب الأول. مراقبة عدم تكرار محاولات الإنشاء.",
  },
  STOCK_OUT_DURING_CHECKOUT: {
    code: "STOCK_OUT_DURING_CHECKOUT",
    category: "stock",
    severity: "error",
    customer: "نأسف، نفد المنتج التالي أثناء إتمام الطلب. تم تحديث سلتك ولن يتم خصم قيمته.",
    admin: "كمية المنتج أصبحت 0 بين فتح Checkout وتأكيد الطلب. يلزم تحديث المخزون.",
    action: "إزالة المنتج من السلة، إعادة احتساب المجموع، اقتراح بديل مشابه.",
  },
  PRICE_CHANGED_DURING_CHECKOUT: {
    code: "PRICE_CHANGED_DURING_CHECKOUT",
    category: "checkout",
    severity: "warning",
    customer: "تغيّر سعر أحد المنتجات أثناء إتمام الطلب. يرجى مراجعة الإجمالي قبل التأكيد.",
    admin: "Price drift بين السلة والـ checkout — أعد تقديم الإجمالي للعميل قبل الدفع.",
    action: "إعادة عرض الإجمالي الجديد وطلب تأكيد صريح من العميل قبل المتابعة.",
  },
  COUPON_INVALID: {
    code: "COUPON_INVALID",
    category: "discount",
    severity: "info",
    customer: "كود الخصم غير صحيح. تأكد من كتابته أو جرّب كودًا آخر.",
    admin: "كود غير موجود في جدول coupons أو لم يطابق شروط الاستخدام.",
    action: "إزالة الكود من السلة دون التأثير على بقية البيانات.",
  },
  COUPON_EXPIRED: {
    code: "COUPON_EXPIRED",
    category: "discount",
    severity: "info",
    customer: "انتهت صلاحية كود الخصم هذا. يمكنك تصفح العروض الحالية.",
    admin: "كود فعّال سابقًا لكنه تجاوز expires_at أو وصل لحد الاستخدام.",
    action: "إزالة الكود واقتراح كوبون نشط بديل إن توفر.",
  },
  SHIPPING_PROVIDER_DOWN: {
    code: "SHIPPING_PROVIDER_DOWN",
    category: "shipping",
    severity: "error",
    customer: "خدمة الشحن غير متاحة مؤقتًا. سنتواصل معك لتأكيد الشحن، ولن تخسر طلبك.",
    admin: "Shipping API لم يستجب أو رجّع 5xx. يلزم تحويل الطلب لقائمة الإنشاء اليدوي.",
    action: "حفظ الطلب بحالة awaiting_shipment_manual وإشعار فريق العمليات.",
  },
  ADDRESS_OUT_OF_RANGE: {
    code: "ADDRESS_OUT_OF_RANGE",
    category: "location",
    severity: "warning",
    customer: "عنوانك خارج نطاق التوصيل حاليًا. يمكنك اختيار عنوان آخر أو الاستلام من الفرع.",
    admin: "المنطقة غير مغطاة في shipping_zones. تحقق من تحديث الخرائط.",
    action: "اقتراح أقرب منطقة مغطاة أو خيار Pickup بدون فقدان السلة.",
  },
  PRODUCT_NOT_AVAILABLE_IN_CITY: {
    code: "PRODUCT_NOT_AVAILABLE_IN_CITY",
    category: "stock",
    severity: "warning",
    customer: "هذا المنتج غير متاح للتوصيل إلى مدينتك حاليًا.",
    admin: "قيد city_restrictions فعّال على المنتج. أزل المنتج أو غيّر العنوان.",
    action: "إخفاء المنتج وعرض بدائل متاحة في نفس المدينة.",
  },
  GEOLOCATION_FAILED: {
    code: "GEOLOCATION_FAILED",
    category: "location",
    severity: "info",
    customer: "تعذّر تحديد موقعك تلقائيًا. يمكنك إدخال العنوان يدويًا.",
    admin: "Browser Geolocation API رفض/فشل (permission denied or timeout).",
    action: "عرض حقل عنوان يدوي مع اقتراحات.",
  },
  SMS_SEND_FAILED: {
    code: "SMS_SEND_FAILED",
    category: "messaging",
    severity: "warning",
    customer: "تم استلام طلبك. تأخر إرسال رسالة التأكيد، وسنحاول مجددًا تلقائيًا.",
    admin: "مزود SMS أعاد خطأ. الطلب لم يتأثر، فقط الإشعار.",
    action: "إضافة الرسالة لقائمة إعادة المحاولة (3 محاولات بفاصل تصاعدي).",
  },
  WHATSAPP_SEND_FAILED: {
    code: "WHATSAPP_SEND_FAILED",
    category: "messaging",
    severity: "warning",
    customer: "تم استلام طلبك. تأخر إرسال رسالة WhatsApp، وسنحاول مجددًا.",
    admin: "WhatsApp Business API رفض الإرسال (template/window/24h).",
    action: "تحويل تلقائي إلى SMS كبديل، وتسجيل سبب الرفض.",
  },
  SHIPMENT_CREATE_FAILED: {
    code: "SHIPMENT_CREATE_FAILED",
    category: "shipping",
    severity: "error",
    customer: "تم استلام طلبك. سنقوم بترتيب الشحن يدويًا والتواصل معك قريبًا.",
    admin: "فشل إنشاء AWB لدى شركة الشحن. الطلب موجود لكن بدون رقم تتبع.",
    action: "نقل الطلب لقائمة manual_shipping وتنبيه فريق العمليات.",
  },
  WEBHOOK_FAILED: {
    code: "WEBHOOK_FAILED",
    category: "webhook",
    severity: "error",
    customer: "",
    admin: "Webhook خارجي لم يُعالَج بنجاح (signature/timeout/5xx).",
    action: "حفظ الـ payload في dead-letter وإعادة المحاولة بـ exponential backoff.",
  },
  STOCK_INCONSISTENCY: {
    code: "STOCK_INCONSISTENCY",
    category: "stock",
    severity: "critical",
    customer: "حدث خطأ بسيط في توفر المنتج. سنتواصل معك خلال دقائق لتأكيد الطلب.",
    admin: "كمية محجوزة > الكمية المتاحة، أو عدم تطابق بين order_items والمخزون.",
    action: "إيقاف بيع المنتج مؤقتًا ومطابقة المخزون يدويًا.",
  },
  NETWORK_OFFLINE: {
    code: "NETWORK_OFFLINE",
    category: "network",
    severity: "warning",
    customer: "انقطع الاتصال بالإنترنت. لا تقلق — تم حفظ بيانات سلتك وسنكمل تلقائيًا عند عودة الاتصال.",
    admin: "navigator.onLine = false أثناء عملية الطلب. الإجراء معلّق في طابور الإعادة.",
    action: "حفظ المسودة محليًا وإعادة الإرسال عند رجوع الاتصال.",
  },
  SYSTEM_ERROR: {
    code: "SYSTEM_ERROR",
    category: "system",
    severity: "error",
    customer: "حدث خطأ غير متوقع. حاول مرة أخرى، وإن استمر تواصل معنا — بياناتك محفوظة.",
    admin: "Unhandled exception. راجع stack trace في الـ context.",
    action: "تنبيه فوري لفريق التطوير، الاحتفاظ بسلة العميل ومسودة الطلب.",
  },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERRORS;

export interface LogErrorOptions {
  context?: Record<string, unknown>;
  userId?: string | null;
  orderId?: string | null;
}

/** Log an error to the database and also to the console. Never throws. */
export async function logError(code: ErrorCode, opts: LogErrorOptions = {}) {
  const def = ERRORS[code];
  const payload = {
    code: def.code,
    severity: def.severity,
    category: def.category,
    message_customer: def.customer || null,
    message_admin: def.admin,
    suggested_action: def.action,
    context: (opts.context ?? {}) as never,
    user_id: opts.userId ?? null,
    order_id: opts.orderId ?? null,
    url: typeof window !== "undefined" ? window.location.href : null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
  try {
    // eslint-disable-next-line no-console
    console.error(`[${def.severity.toUpperCase()}] ${def.code}`, payload);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      bufferOffline(payload);
      return;
    }
    await sb.from("error_logs").insert(payload);
  } catch (e) {
    bufferOffline(payload);
  }
}

// ---------- Offline buffer ----------
const BUFFER_KEY = "lovable_error_buffer";

function bufferOffline(payload: Record<string, unknown>) {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
    arr.push({ ...payload, _bufferedAt: new Date().toISOString() });
    localStorage.setItem(BUFFER_KEY, JSON.stringify(arr.slice(-50)));
  } catch { /* ignore */ }
}

export async function flushErrorBuffer() {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(BUFFER_KEY);
  if (!raw) return;
  try {
    const arr = JSON.parse(raw) as Record<string, unknown>[];
    if (!arr.length) return;
    await sb.from("error_logs").insert(arr);
    localStorage.removeItem(BUFFER_KEY);
  } catch { /* keep buffered for next time */ }
}

// ---------- Idempotency helper ----------
/**
 * Generate a stable idempotency key for a sensitive action (e.g., payment).
 * Use the same key on retry to avoid duplicate orders/charges.
 */
export function makeIdempotencyKey(scope: string, seed?: string): string {
  const base = seed ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${scope}:${base}`;
}

/**
 * Reserve an idempotency key. Returns existing result if already used.
 */
export async function withIdempotency<T>(
  key: string,
  scope: string,
  fn: () => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  // Try to insert; if already exists, return stored result
  const { data: existing } = await sb
    .from("idempotency_keys")
    .select("status, result")
    .eq("key", key)
    .maybeSingle();

  if (existing && existing.status === "success") {
    return { result: existing.result as T, replayed: true };
  }
  if (existing && existing.status === "pending") {
    await logError("PAYMENT_DOUBLE_CLICK", { context: { key, scope } });
    return { result: existing.result as T, replayed: true };
  }

  await sb.from("idempotency_keys").upsert({
    key,
    scope,
    status: "pending",
  });

  try {
    const result = await fn();
    await sb
      .from("idempotency_keys")
      .update({ status: "success", result })
      .eq("key", key);
    return { result, replayed: false };
  } catch (e) {
    await sb
      .from("idempotency_keys")
      .update({ status: "failed" })
      .eq("key", key);
    throw e;
  }
}

// Auto-flush buffered errors when network returns
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushErrorBuffer().catch(() => { /* noop */ });
  });
}
