import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { generateInvoiceForOrder, cancelInvoice, formatMoney } from "@/lib/invoices";
import { Plus, Eye, Search, Settings, Save, Ban, Receipt } from "lucide-react";

export const Route = createFileRoute("/admin/invoices")({
  component: InvoicesAdmin,
});

function InvoicesAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [tab, setTab] = useState<"list" | "settings">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("invoices").select("*").order("issued_at", { ascending: false }).limit(500);
    setList(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => list.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${i.invoice_number} ${i.order_number ?? ""} ${i.customer_email ?? ""} ${i.customer_name ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [list, statusFilter, search]);

  async function createForOrder() {
    if (!orderId.trim()) return;
    setBusy(true);
    try {
      const inv = await generateInvoiceForOrder(orderId.trim());
      setOrderId(""); await load();
      alert(`تم إنشاء الفاتورة: ${inv.invoice_number}`);
    } catch (e: any) {
      alert(e.message);
    } finally { setBusy(false); }
  }

  async function doCancel(id: string) {
    const reason = prompt("سبب الإلغاء:");
    if (!reason) return;
    await cancelInvoice(id, reason); await load();
  }

  const totals = useMemo(() => {
    const issued = list.filter((i) => i.status !== "cancelled");
    return {
      count: issued.length,
      revenue: issued.reduce((s, i) => s + Number(i.total), 0),
      tax: issued.reduce((s, i) => s + Number(i.tax_total), 0),
      paid: issued.filter((i) => i.payment_status === "paid").length,
    };
  }, [list]);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">الفواتير والضرائب</h1>
        <div className="flex gap-1 rounded-md border border-border p-1">
          <button onClick={() => setTab("list")} className={`px-3 py-1 text-xs rounded ${tab==="list"?"bg-primary text-primary-foreground":""}`}>الفواتير</button>
          <button onClick={() => setTab("settings")} className={`flex items-center gap-1 px-3 py-1 text-xs rounded ${tab==="settings"?"bg-primary text-primary-foreground":""}`}><Settings className="h-3 w-3"/>الإعدادات</button>
        </div>
      </div>

      {tab === "settings" ? <BillingSettings/> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="عدد الفواتير" value={String(totals.count)} />
            <Stat label="إجمالي الإيراد" value={formatMoney(totals.revenue)} />
            <Stat label="إجمالي الضريبة" value={formatMoney(totals.tax)} />
            <Stat label="مدفوعة" value={`${totals.paid} / ${totals.count}`} />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="معرف الطلب لإصدار فاتورة (UUID)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono" />
            <button onClick={createForOrder} disabled={busy} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
              <Plus className="h-3.5 w-3.5"/> إصدار فاتورة
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(["all","issued","cancelled"]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-xs ${statusFilter===s?"bg-primary text-primary-foreground":"border border-border"}`}>
                {s === "all" ? "الكل" : s === "issued" ? "صادرة" : "ملغاة"}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
                className="rounded-md border border-border bg-background py-1.5 pl-3 pr-7 text-xs" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">الطلب</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">الضريبة</th>
                  <th className="p-3">الدفع</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs">{i.invoice_number}</td>
                    <td className="p-3 text-xs">{i.invoice_type === "tax_invoice" ? "ضريبية" : i.invoice_type === "credit_note" ? "دائن" : "مبسطة"}</td>
                    <td className="p-3 text-xs">{i.order_number}</td>
                    <td className="p-3 text-xs">{i.customer_name}<div className="text-[10px] text-muted-foreground">{i.customer_email}</div></td>
                    <td className="p-3 text-xs">{formatMoney(i.total)}</td>
                    <td className="p-3 text-xs">{formatMoney(i.tax_total)}</td>
                    <td className="p-3 text-xs">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${i.payment_status==="paid"?"bg-green-100 text-green-800":"bg-amber-100 text-amber-800"}`}>
                        {i.payment_status === "paid" ? "مدفوعة" : "غير مدفوعة"}
                      </span>
                      {i.status === "cancelled" && <span className="mr-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-800">ملغاة</span>}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">{new Date(i.issued_at).toLocaleDateString("ar")}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Link to="/invoice/$id" params={{ id: i.id }} className="rounded p-1.5 hover:bg-muted" title="عرض"><Eye className="h-3.5 w-3.5"/></Link>
                        {i.status !== "cancelled" && (
                          <button onClick={() => doCancel(i.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="إلغاء"><Ban className="h-3.5 w-3.5"/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-xs text-muted-foreground">لا توجد فواتير</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function BillingSettings() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { void supabase.from("site_settings").select("*").maybeSingle().then(({data}) => setS(data)); }, []);

  async function save() {
    if (!s?.id) return;
    const { error } = await supabase.from("site_settings").update({
      company_legal_name: s.company_legal_name, tax_number: s.tax_number, commercial_register: s.commercial_register,
      store_address: s.store_address, store_city: s.store_city, store_country: s.store_country, store_phone: s.store_phone,
      invoice_logo_url: s.invoice_logo_url, invoice_prefix: s.invoice_prefix, invoice_footer_note: s.invoice_footer_note,
      tax_rate: Number(s.tax_rate ?? 0), tax_inclusive: s.tax_inclusive, tax_label: s.tax_label,
      currency_code: s.currency_code, currency_symbol: s.currency_symbol,
      issue_tax_invoice: s.issue_tax_invoice, auto_issue_on_payment: s.auto_issue_on_payment,
    }).eq("id", s.id);
    if (error) alert(error.message); else alert("تم الحفظ");
  }

  if (!s) return <div className="rounded-xl border border-border p-6 text-center text-sm">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <Section title={<><Receipt className="inline h-4 w-4"/> بيانات المنشأة على الفاتورة</>}>
        <Field label="الاسم القانوني" value={s.company_legal_name} onChange={(v) => setS({...s, company_legal_name:v})}/>
        <Field label="الرقم الضريبي (VAT)" value={s.tax_number} onChange={(v) => setS({...s, tax_number:v})}/>
        <Field label="السجل التجاري" value={s.commercial_register} onChange={(v) => setS({...s, commercial_register:v})}/>
        <Field label="هاتف المتجر" value={s.store_phone} onChange={(v) => setS({...s, store_phone:v})}/>
        <Field label="عنوان المتجر" value={s.store_address} onChange={(v) => setS({...s, store_address:v})}/>
        <Field label="المدينة" value={s.store_city} onChange={(v) => setS({...s, store_city:v})}/>
        <Field label="الدولة (ISO)" value={s.store_country} onChange={(v) => setS({...s, store_country:v})}/>
        <Field label="شعار الفاتورة (URL)" value={s.invoice_logo_url} onChange={(v) => setS({...s, invoice_logo_url:v})}/>
      </Section>

      <Section title="الضريبة والعملة">
        <Field label="نسبة الضريبة %" type="number" value={String(s.tax_rate ?? 0)} onChange={(v) => setS({...s, tax_rate:v})}/>
        <Field label="مسمى الضريبة" value={s.tax_label} onChange={(v) => setS({...s, tax_label:v})}/>
        <Field label="رمز العملة" value={s.currency_code} onChange={(v) => setS({...s, currency_code:v})}/>
        <Field label="رمز العرض" value={s.currency_symbol} onChange={(v) => setS({...s, currency_symbol:v})}/>
        <label className="flex items-center gap-2 self-end text-sm md:col-span-2">
          <input type="checkbox" checked={s.tax_inclusive ?? true} onChange={(e) => setS({...s, tax_inclusive:e.target.checked})}/>
          الأسعار شاملة الضريبة
        </label>
      </Section>

      <Section title="إعدادات الفاتورة">
        <Field label="بادئة رقم الفاتورة" value={s.invoice_prefix} onChange={(v) => setS({...s, invoice_prefix:v})}/>
        <Field label="ملاحظة أسفل الفاتورة" value={s.invoice_footer_note} onChange={(v) => setS({...s, invoice_footer_note:v})}/>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={s.issue_tax_invoice ?? true} onChange={(e) => setS({...s, issue_tax_invoice:e.target.checked})}/>
          إصدار فواتير ضريبية
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={s.auto_issue_on_payment ?? true} onChange={(e) => setS({...s, auto_issue_on_payment:e.target.checked})}/>
          إصدار تلقائي عند الدفع
        </label>
      </Section>

      <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        <Save className="h-4 w-4"/> حفظ الإعدادات
      </button>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
    </label>
  );
}
