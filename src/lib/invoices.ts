import { supabase } from "@/integrations/supabase/client";

export type InvoiceItem = {
  product_id?: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  tax_amount?: number;
};

export type StoreSnapshot = {
  store_name?: string;
  company_legal_name?: string;
  tax_number?: string;
  commercial_register?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  footer_note?: string;
};

export type CustomerSnapshot = {
  name?: string;
  email?: string;
  phone?: string;
  tax_number?: string;
  address?: any;
};

export async function loadStoreSnapshot(): Promise<StoreSnapshot> {
  const { data: s } = await supabase.from("public_site_settings" as any).select("*").maybeSingle() as { data: any };
  if (!s) return {};
  return {
    store_name: s.store_name ?? "",
    company_legal_name: s.company_legal_name ?? s.store_name ?? "",
    tax_number: s.tax_number ?? "",
    commercial_register: s.commercial_register ?? "",
    address: s.store_address ?? "",
    city: s.store_city ?? "",
    country: s.store_country ?? "SA",
    phone: s.store_phone ?? "",
    email: s.support_email ?? "",
    logo_url: s.invoice_logo_url ?? "",
    footer_note: s.invoice_footer_note ?? "",
  };
}

export async function generateInvoiceForOrder(orderId: string, opts?: { type?: "tax_invoice" | "simplified" | "credit_note" }) {
  // Idempotency: if an active invoice exists for the order, return it
  const { data: existing } = await supabase
    .from("invoices").select("*").eq("order_id", orderId).neq("status", "cancelled").maybeSingle();
  if (existing) return existing;

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("الطلب غير موجود");
  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId);
  const { data: settings } = await supabase.from("public_site_settings" as any).select("*").maybeSingle() as { data: any };

  const taxRate = Number(settings?.tax_rate ?? 0);
  const taxInclusive = settings?.tax_inclusive ?? true;
  const subtotal = Number(order.subtotal);
  const shipping = Number(order.shipping_fee ?? 0);
  const discount = Math.max(0, (subtotal + shipping + Number(order.tax ?? 0)) - Number(order.total));
  const taxTotal = Number(order.tax ?? 0);

  const store = await loadStoreSnapshot();
  const prefix = settings?.invoice_prefix ?? "INV";
  const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number", { _prefix: prefix });
  if (numErr) throw numErr;

  const payload: any = {
    invoice_number: numData,
    invoice_type: opts?.type ?? (settings?.issue_tax_invoice ? "tax_invoice" : "simplified"),
    status: "issued",
    order_id: order.id,
    order_number: order.order_number,
    user_id: order.user_id,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    store_snapshot: store as any,
    customer_snapshot: { address: order.shipping_address } as any,
    items: (items ?? []).map((it: any) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      qty: it.qty,
      unit_price: Number(it.unit_price),
      line_total: Number(it.line_total),
    })) as any,
    subtotal,
    discount_total: discount,
    shipping_fee: shipping,
    tax_total: taxTotal,
    tax_rate: taxRate,
    tax_inclusive: taxInclusive,
    total: Number(order.total),
    currency: order.currency ?? "SAR",
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    paid_at: order.payment_status === "paid" ? new Date().toISOString() : null,
  };
  const { data: inv, error } = await supabase.from("invoices").insert(payload).select("*").single();
  if (error) throw error;
  return inv;
}

export async function cancelInvoice(invoiceId: string, reason: string) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("invoices").update({
    status: "cancelled", cancelled_at: new Date().toISOString(),
    cancellation_reason: reason, cancelled_by: user?.id,
  }).eq("id", invoiceId);
}

export async function markInvoiceEmailed(invoiceId: string) {
  const { data: inv } = await supabase.from("invoices").select("email_sent_count").eq("id", invoiceId).maybeSingle();
  await supabase.from("invoices").update({
    email_sent_at: new Date().toISOString(),
    email_sent_count: (inv?.email_sent_count ?? 0) + 1,
  }).eq("id", invoiceId);
}

export function formatMoney(n: number, currency = "ر.س") {
  return `${Number(n).toLocaleString("ar", { maximumFractionDigits: 2 })} ${currency}`;
}
