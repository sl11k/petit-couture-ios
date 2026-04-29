import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateInvoiceForOrder, loadStoreSnapshot, formatMoney, type StoreSnapshot } from "@/lib/invoices";
import { Printer, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/orders/$id/invoice")({
  component: InvoicePrint,
});

function InvoicePrint() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [store, setStore] = useState<StoreSnapshot>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [oRes, iRes, sRes] = await Promise.all([
          supabase.from("orders").select("*").eq("id", id).maybeSingle(),
          supabase.from("order_items").select("*").eq("order_id", id),
          loadStoreSnapshot(),
        ]);
        if (!oRes.data) throw new Error("الطلب غير موجود");
        setOrder(oRes.data);
        setItems(iRes.data ?? []);
        setStore(sRes);

        // Try existing invoice or generate one
        const { data: existing } = await supabase
          .from("invoices").select("*").eq("order_id", id).neq("status", "cancelled").maybeSingle();
        if (existing) {
          setInvoice(existing);
        } else {
          const inv = await generateInvoiceForOrder(id);
          setInvoice(inv);
        }
      } catch (e: any) {
        setError(e.message ?? "فشل تحميل الفاتورة");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!order || !invoice) return null;

  const addr = order.shipping_address ?? {};
  const currency = order.currency === "SAR" ? "ر.س" : (order.currency ?? "ر.س");

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 print:bg-white">
      {/* Toolbar — مخفي عند الطباعة */}
      <div className="print:hidden sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between p-3">
          <a href={`/admin/orders/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-4 h-4" /> رجوع للطلب
          </a>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Printer className="w-4 h-4" /> طباعة / حفظ PDF
          </button>
        </div>
      </div>

      {/* الفاتورة — A4 */}
      <div className="max-w-[210mm] mx-auto bg-background my-6 p-10 shadow-sm print:shadow-none print:my-0 print:max-w-none">
        {/* Header */}
        <header className="flex items-start justify-between border-b pb-6 mb-6">
          <div className="flex items-start gap-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.store_name ?? ""} className="w-20 h-20 object-contain" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {(store.store_name ?? "M").charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{store.company_legal_name || store.store_name || "المتجر"}</h1>
              {store.store_name && store.company_legal_name !== store.store_name && (
                <p className="text-sm text-muted-foreground">{store.store_name}</p>
              )}
              {store.tax_number && <p className="text-xs text-muted-foreground mt-1">الرقم الضريبي: {store.tax_number}</p>}
              {store.commercial_register && <p className="text-xs text-muted-foreground">س.ت: {store.commercial_register}</p>}
            </div>
          </div>
          <div className="text-end">
            <h2 className="text-2xl font-bold tracking-wide">
              {invoice.invoice_type === "tax_invoice" ? "فاتورة ضريبية" : invoice.invoice_type === "credit_note" ? "إشعار دائن" : "فاتورة مبسطة"}
            </h2>
            <p className="text-sm mt-1">رقم الفاتورة: <span className="font-mono font-semibold">{invoice.invoice_number}</span></p>
            <p className="text-sm">تاريخ الإصدار: {new Date(invoice.created_at ?? Date.now()).toLocaleDateString("ar-SA")}</p>
            <p className="text-sm">رقم الطلب: <span className="font-mono">{order.order_number}</span></p>
          </div>
        </header>

        {/* عميل + متجر */}
        <section className="grid grid-cols-2 gap-6 mb-6">
          <div className="border rounded-lg p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">فاتورة إلى</h3>
            <p className="font-semibold">{order.customer_name ?? addr.name ?? "—"}</p>
            {order.customer_email && <p className="text-sm text-muted-foreground">{order.customer_email}</p>}
            {order.customer_phone && <p className="text-sm text-muted-foreground" dir="ltr">{order.customer_phone}</p>}
            {addr.line1 && <p className="text-sm mt-2">{addr.line1}</p>}
            {addr.line2 && <p className="text-sm">{addr.line2}</p>}
            {(addr.district || addr.city) && <p className="text-sm">{[addr.district, addr.city].filter(Boolean).join("، ")}</p>}
            {addr.postal_code && <p className="text-sm">الرمز البريدي: {addr.postal_code}</p>}
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">من</h3>
            <p className="font-semibold">{store.company_legal_name || store.store_name}</p>
            {store.address && <p className="text-sm">{store.address}</p>}
            {store.city && <p className="text-sm">{store.city}{store.country ? `، ${store.country}` : ""}</p>}
            {store.phone && <p className="text-sm text-muted-foreground" dir="ltr">{store.phone}</p>}
            {store.email && <p className="text-sm text-muted-foreground">{store.email}</p>}
          </div>
        </section>

        {/* جدول العناصر */}
        <section className="mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted text-start">
                <th className="text-start p-3 font-semibold border-b w-10">#</th>
                <th className="text-start p-3 font-semibold border-b">المنتج</th>
                <th className="text-center p-3 font-semibold border-b w-20">الكمية</th>
                <th className="text-end p-3 font-semibold border-b w-32">سعر الوحدة</th>
                <th className="text-end p-3 font-semibold border-b w-32">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id ?? i} className="border-b">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-medium">{it.product_name}</div>
                    {it.variant_label && <div className="text-xs text-muted-foreground mt-0.5">{it.variant_label}</div>}
                    {it.sku && <div className="text-xs text-muted-foreground font-mono">SKU: {it.sku}</div>}
                  </td>
                  <td className="p-3 text-center">{it.qty}</td>
                  <td className="p-3 text-end font-mono">{formatMoney(Number(it.unit_price), currency)}</td>
                  <td className="p-3 text-end font-mono font-semibold">{formatMoney(Number(it.line_total), currency)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد عناصر</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* الإجماليات */}
        <section className="flex justify-end mb-6">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <Row label="المجموع الفرعي" value={formatMoney(Number(invoice.subtotal), currency)} />
            {Number(invoice.discount_total) > 0 && (
              <Row label="الخصم" value={`- ${formatMoney(Number(invoice.discount_total), currency)}`} className="text-success" />
            )}
            {Number(invoice.shipping_fee) > 0 && (
              <Row label="الشحن" value={formatMoney(Number(invoice.shipping_fee), currency)} />
            )}
            {Number(invoice.tax_total) > 0 && (
              <Row label={`الضريبة (${Number(invoice.tax_rate)}%)${invoice.tax_inclusive ? " — شاملة" : ""}`} value={formatMoney(Number(invoice.tax_total), currency)} />
            )}
            <div className="border-t pt-2 mt-2">
              <Row label="الإجمالي المستحق" value={formatMoney(Number(invoice.total), currency)} className="text-base font-bold" />
            </div>
          </div>
        </section>

        {/* الدفع */}
        <section className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div className="border rounded-lg p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">حالة الدفع</h3>
            <p>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                invoice.payment_status === "paid" ? "bg-success/15 text-success" :
                invoice.payment_status === "refunded" ? "bg-muted text-muted-foreground" :
                "bg-warning/15 text-warning"
              }`}>
                {invoice.payment_status === "paid" ? "مدفوعة" : invoice.payment_status === "refunded" ? "مستردة" : "غير مدفوعة"}
              </span>
            </p>
            {invoice.payment_method && <p className="mt-2 text-muted-foreground">طريقة الدفع: {invoice.payment_method}</p>}
            {invoice.paid_at && <p className="text-muted-foreground">تاريخ الدفع: {new Date(invoice.paid_at).toLocaleDateString("ar-SA")}</p>}
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">ملاحظات</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">{store.footer_note ?? "شكراً لتسوّقك معنا. للاستفسارات يرجى التواصل عبر بيانات المتجر."}</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t pt-4 mt-8 text-center text-xs text-muted-foreground">
          <p>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع.</p>
          <p className="mt-1">{store.company_legal_name || store.store_name} — {invoice.invoice_number}</p>
        </footer>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
