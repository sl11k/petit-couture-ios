import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "voided";

export type Gateway = "manual" | "stripe" | "tap" | "moyasar" | "hyperpay" | "tabby" | "tamara";

export interface CreateTransactionInput {
  order_id?: string;
  order_number?: string;
  customer_email?: string;
  customer_name?: string;
  amount: number;
  currency?: string;
  gateway: Gateway;
  gateway_method?: string;
  idempotency_key?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a payment transaction record. Uses idempotency_key to prevent
 * duplicate charges when the user double-clicks "Pay".
 */
export async function createTransaction(input: CreateTransactionInput) {
  const idempotency_key =
    input.idempotency_key ||
    `${input.order_id || input.order_number || "anon"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Try to find existing by idempotency_key first
  if (input.idempotency_key) {
    const { data: existing } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (existing) return { data: existing, error: null, duplicate: true };
  }

  const { data, error } = await supabase
    .from("payment_transactions")
    .insert({
      order_id: input.order_id ?? null,
      order_number: input.order_number ?? null,
      customer_email: input.customer_email ?? null,
      customer_name: input.customer_name ?? null,
      amount: input.amount,
      currency: input.currency || "SAR",
      gateway: input.gateway,
      gateway_method: input.gateway_method ?? null,
      status: "pending",
      idempotency_key,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  return { data, error, duplicate: false };
}

export async function markTransactionStatus(
  transactionId: string,
  status: PaymentStatus,
  extra: {
    gateway_transaction_id?: string;
    error_code?: string;
    error_message?: string;
    gateway_fee?: number;
    raw_response?: any;
    webhook_verified?: boolean;
    card_last4?: string;
    card_brand?: string;
  } = {},
) {
  const update: any = { status, updated_at: new Date().toISOString() };
  const now = new Date().toISOString();
  if (status === "authorized") update.authorized_at = now;
  if (status === "captured" || status === "paid") update.captured_at = now;
  if (status === "failed") update.failed_at = now;
  if (extra.gateway_fee !== undefined) {
    update.gateway_fee = extra.gateway_fee;
  }
  Object.assign(update, extra);

  const { error } = await supabase.from("payment_transactions").update(update).eq("id", transactionId);

  // Auto-issue invoice on successful payment if enabled in settings
  if (!error && (status === "captured" || status === "paid")) {
    try {
      const { data: txn } = await supabase.from("payment_transactions").select("order_id").eq("id", transactionId).maybeSingle();
      const { data: settings } = await supabase.from("site_settings").select("auto_issue_on_payment").maybeSingle();
      if (txn?.order_id && settings?.auto_issue_on_payment !== false) {
        const { generateInvoiceForOrder } = await import("@/lib/invoices");
        await generateInvoiceForOrder(txn.order_id).catch(() => null);
      }
    } catch { /* non-fatal */ }
  }
  return { error };
}

/**
 * Process a refund. Validates that refund amount doesn't exceed available.
 */
export async function createRefund(input: {
  transaction_id: string;
  order_id?: string;
  amount: number;
  reason: string;
  approved_by?: string;
  approved_by_email?: string;
}) {
  const { data: txn, error: txnErr } = await supabase
    .from("payment_transactions")
    .select("amount, currency, status, order_id")
    .eq("id", input.transaction_id)
    .single();
  if (txnErr || !txn) return { error: txnErr || new Error("Transaction not found") };

  if (txn.status !== "captured" && txn.status !== "paid") {
    return { error: new Error("لا يمكن استرداد عملية غير مكتملة") };
  }

  // Sum existing refunds
  const { data: existing } = await supabase
    .from("payment_refunds")
    .select("amount")
    .eq("transaction_id", input.transaction_id)
    .in("status", ["pending", "completed"]);
  const refundedSoFar = (existing || []).reduce((s, r) => s + Number(r.amount), 0);
  const available = Number(txn.amount) - refundedSoFar;
  if (input.amount > available) {
    return { error: new Error(`المبلغ المتاح للاسترداد ${available.toFixed(2)} فقط`) };
  }

  const isPartial = input.amount < Number(txn.amount);

  const { data: refund, error } = await supabase
    .from("payment_refunds")
    .insert({
      transaction_id: input.transaction_id,
      order_id: input.order_id ?? txn.order_id,
      amount: input.amount,
      currency: txn.currency,
      reason: input.reason,
      is_partial: isPartial,
      status: "completed", // for manual gateway; gateway-based should be 'pending'
      approved_by: input.approved_by ?? null,
      approved_by_email: input.approved_by_email ?? null,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error };

  // Update order refunded_amount + status
  if (txn.order_id) {
    const newRefunded = refundedSoFar + input.amount;
    const fullyRefunded = newRefunded >= Number(txn.amount);
    await supabase
      .from("orders")
      .update({
        refunded_amount: newRefunded,
        payment_status: fullyRefunded ? "refunded" : "partially_refunded",
      })
      .eq("id", txn.order_id);

    if (fullyRefunded) {
      await markTransactionStatus(input.transaction_id, "refunded");
    } else {
      await markTransactionStatus(input.transaction_id, "partially_refunded");
    }
  }

  return { data: refund, error: null };
}

/**
 * Maps internal payment errors to user-friendly Arabic messages
 */
export function userFriendlyError(code?: string, message?: string): string {
  const map: Record<string, string> = {
    card_declined: "تم رفض البطاقة من قبل البنك. الرجاء استخدام بطاقة أخرى.",
    insufficient_funds: "رصيد غير كافٍ في البطاقة.",
    expired_card: "البطاقة منتهية الصلاحية.",
    invalid_cvc: "رمز الأمان (CVV) غير صحيح.",
    processing_error: "حدث خطأ أثناء المعالجة. حاول مرة أخرى.",
    session_expired: "انتهت جلسة الدفع. الرجاء إعادة المحاولة.",
    duplicate_transaction: "هذه العملية تمت مسبقًا.",
    amount_mismatch: "خطأ في مبلغ الدفع. الرجاء التواصل مع الدعم.",
    webhook_failed: "تأخر في تأكيد الدفع. سنتواصل معك خلال دقائق.",
  };
  if (code && map[code]) return map[code];
  if (message && message.length < 200) return message;
  return "حدث خطأ في عملية الدفع. الرجاء المحاولة لاحقًا أو اختيار طريقة دفع أخرى.";
}

export function paymentStatusLabel(status: string): { ar: string; tone: string } {
  const m: Record<string, { ar: string; tone: string }> = {
    pending: { ar: "قيد الانتظار", tone: "bg-amber-100 text-amber-800" },
    authorized: { ar: "محجوز", tone: "bg-blue-100 text-blue-800" },
    captured: { ar: "مكتمل", tone: "bg-emerald-100 text-emerald-800" },
    paid: { ar: "مدفوع", tone: "bg-emerald-100 text-emerald-800" },
    failed: { ar: "فشل", tone: "bg-red-100 text-red-800" },
    expired: { ar: "منتهي", tone: "bg-gray-200 text-gray-800" },
    refunded: { ar: "مسترد كاملًا", tone: "bg-purple-100 text-purple-800" },
    partially_refunded: { ar: "مسترد جزئيًا", tone: "bg-purple-100 text-purple-800" },
    voided: { ar: "ملغى", tone: "bg-gray-200 text-gray-800" },
  };
  return m[status] || { ar: status, tone: "bg-muted text-foreground" };
}
