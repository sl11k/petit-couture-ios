import { createFileRoute, useParams } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, markInvoiceEmailed } from "@/lib/invoices";
import { Printer, Download, Mail, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/invoice/$id")({
  head: () =>
    buildMeta({
      title: "الفاتورة — Maisonnét",
      description: "عرض فاتورة طلبك من Maisonnét.",
      path: "/invoice",
      noindex: true,
    }),
  component: InvoiceView,
});

function InvoiceView() {
  const { id } = useParams({ from: "/invoice/$id" });
  const [inv, setInv] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
      setInv(data);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const roles = (r ?? []).map((x: any) => x.role);
        setCanManage(roles.some((x) => ["admin", "manager", "staff"].includes(x)));
      }
    })();
  }, [id]);

  if (!inv) return <div className="p-10 text-center">جارٍ التحميل...</div>;

  const store = inv.store_snapshot ?? {};
  const cust = inv.customer_snapshot ?? {};
  const addr = cust.address ?? {};
  const cur = inv.currency === "SAR" ? "ر.س" : inv.currency;

  async function emailInvoice() {
    setSending(true);
    try {
      await markInvoiceEmailed(id);
      alert("تم تسجيل إرسال الفاتورة بالإيميل (سيتم عبر نظام الإيميل المُعدّ).");
    } finally { setSending(false); }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <Link to="/account" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4"/> رجوع
          </Link>
          <div className="ml-auto flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              <Printer className="h-4 w-4"/> طباعة / PDF
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm">
              <Download className="h-4 w-4"/> تحميل PDF
            </button>
            {canManage && (
              <button onClick={emailInvoice} disabled={sending} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">
                <Mail className="h-4 w-4"/> {sending ? "..." : "إرسال للعميل"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          {inv.status === "cancelled" && (
            <div className="mb-4 rounded bg-red-50 p-2 text-center text-sm text-red-800">فاتورة ملغاة — {inv.cancellation_reason}</div>
          )}

          <div className="mb-6 flex items-start justify-between border-b border-border pb-5">
            <div>
              {store.logo_url && <img src={store.logo_url} alt="" className="mb-3 h-14 object-contain" />}
              <h1 className="text-xl font-bold">{store.company_legal_name || store.store_name}</h1>
              {store.tax_number && <p className="mt-1 text-xs text-muted-foreground">الرقم الضريبي: {store.tax_number}</p>}
              {store.commercial_register && <p className="text-xs text-muted-foreground">س.ت: {store.commercial_register}</p>}
              {store.address && <p className="mt-1 text-xs text-muted-foreground">{store.address}{store.city ? `، ${store.city}` : ""}</p>}
              {store.phone && <p className="text-xs text-muted-foreground">هاتف: {store.phone}</p>}
              {store.email && <p className="text-xs text-muted-foreground">{store.email}</p>}
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold">{inv.invoice_type === "tax_invoice" ? "فاتورة ضريبية" : inv.invoice_type === "credit_note" ? "إشعار دائن" : "فاتورة"}</div>
              <div className="mt-1 font-mono text-sm">{inv.invoice_number}</div>
              <div className="mt-2 text-xs text-muted-foreground">تاريخ الإصدار: {new Date(inv.issued_at).toLocaleDateString("ar")}</div>
              <div className="text-xs text-muted-foreground">الطلب: {inv.order_number}</div>
              <div className="mt-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${inv.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {inv.payment_status === "paid" ? "مدفوعة" : "غير مدفوعة"}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">العميل</div>
              <div className="text-sm font-medium">{inv.customer_name}</div>
              {inv.customer_email && <div className="text-xs">{inv.customer_email}</div>}
              {inv.customer_phone && <div className="text-xs">{inv.customer_phone}</div>}
              {inv.customer_tax_number && <div className="mt-1 text-xs">الرقم الضريبي: {inv.customer_tax_number}</div>}
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">عنوان الشحن</div>
              <div className="text-xs">{addr.address ?? ""}</div>
              <div className="text-xs">{addr.city ?? ""} {addr.region ?? ""}</div>
              <div className="text-xs">{addr.country ?? store.country}</div>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead className="border-b-2 border-border">
              <tr className="text-right text-xs">
                <th className="p-2">المنتج</th>
                <th className="p-2 text-center">الكمية</th>
                <th className="p-2 text-left">السعر</th>
                <th className="p-2 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items as any[]).map((it, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-2">{it.product_name}</td>
                  <td className="p-2 text-center">{it.qty}</td>
                  <td className="p-2 text-left">{formatMoney(it.unit_price, cur)}</td>
                  <td className="p-2 text-left">{formatMoney(it.line_total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <Row label="المجموع الفرعي" value={formatMoney(inv.subtotal, cur)} />
              {inv.discount_total > 0 && <Row label="الخصم" value={`- ${formatMoney(inv.discount_total, cur)}`} />}
              <Row label="الشحن" value={formatMoney(inv.shipping_fee, cur)} />
              <Row label={`الضريبة (${inv.tax_rate}%${inv.tax_inclusive ? " — شاملة" : ""})`} value={formatMoney(inv.tax_total, cur)} />
              <div className="mt-2 flex justify-between border-t-2 border-border pt-2 font-bold">
                <span>الإجمالي</span>
                <span>{formatMoney(inv.total, cur)}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 border-t border-border pt-4 text-xs text-muted-foreground md:grid-cols-2">
            <div>طريقة الدفع: <span className="font-medium text-foreground">{inv.payment_method ?? "—"}</span></div>
            <div>حالة الدفع: <span className="font-medium text-foreground">{inv.payment_status}</span></div>
          </div>

          {store.footer_note && (
            <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">{store.footer_note}</div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
  );
}
