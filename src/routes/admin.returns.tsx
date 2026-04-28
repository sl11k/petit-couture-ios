import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { RETURN_STATUSES, STATUS_LABELS, STATUS_COLORS, restockItems, type ReturnStatus } from "@/lib/returns";
import { X, Settings, Save, Search, Package, MessageSquare, Truck, Wallet } from "lucide-react";

export const Route = createFileRoute("/admin/returns")({
  component: ReturnsAdmin,
});

function ReturnsAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [tab, setTab] = useState<"requests" | "settings">("requests");
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  async function load() {
    const { data } = await supabase.from("return_requests").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => list.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !`${r.return_number} ${r.order_number ?? ""} ${r.customer_email ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [list, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length };
    for (const s of RETURN_STATUSES) c[s] = list.filter((r) => r.status === s).length;
    return c;
  }, [list]);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">المرتجعات والاستبدال</h1>
        <div className="flex gap-1 rounded-md border border-border p-1">
          <button onClick={() => setTab("requests")} className={`px-3 py-1 text-xs rounded ${tab === "requests" ? "bg-primary text-primary-foreground" : ""}`}>الطلبات</button>
          <button onClick={() => setTab("settings")} className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${tab === "settings" ? "bg-primary text-primary-foreground" : ""}`}><Settings className="h-3 w-3"/> الإعدادات</button>
        </div>
      </div>

      {tab === "settings" ? <SettingsPanel /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setStatusFilter("all")} className={`rounded-full px-3 py-1 text-xs ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "border border-border"}`}>
              الكل ({counts.all})
            </button>
            {RETURN_STATUSES.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs ${statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {STATUS_LABELS[s]} ({counts[s] || 0})
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="رقم/إيميل..."
                className="rounded-md border border-border bg-background py-1.5 pl-3 pr-7 text-xs" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">رقم الإرجاع</th>
                  <th className="p-3">الطلب</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">السبب</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-b border-border/50 hover:bg-muted/20" onClick={() => setSelected(r)}>
                    <td className="p-3 font-mono text-xs">{r.return_number}</td>
                    <td className="p-3 text-xs">{r.order_number}</td>
                    <td className="p-3 text-xs">{r.customer_email}</td>
                    <td className="p-3 text-xs">{r.reason}</td>
                    <td className="p-3 text-xs">{Number(r.refund_amount ?? 0).toFixed(0)} ر.س</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_COLORS[r.status as ReturnStatus]}`}>{STATUS_LABELS[r.status as ReturnStatus] ?? r.status}</span></td>
                    <td className="p-3 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">لا توجد طلبات</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && <ReturnDetailModal req={selected} onClose={() => { setSelected(null); void load(); }} />}
    </AdminShell>
  );
}

function ReturnDetailModal({ req, onClose }: { req: any; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<ReturnStatus>(req.status);
  const [decisionReason, setDecisionReason] = useState(req.decision_reason ?? "");
  const [carrier, setCarrier] = useState(req.return_shipping_carrier ?? "");
  const [tracking, setTracking] = useState(req.return_tracking_number ?? "");
  const [refundAmount, setRefundAmount] = useState(String(req.refund_amount ?? 0));
  const [shippingDeducted, setShippingDeducted] = useState(String(req.shipping_fee_deducted ?? 0));
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);
  const internalNotes = (req.internal_notes ?? []) as any[];

  useEffect(() => {
    void supabase.from("return_items").select("*").eq("return_request_id", req.id).then(({ data }) => setItems(data ?? []));
  }, [req.id]);

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newNotes = internalNote.trim()
        ? [...internalNotes, { text: internalNote, by: user?.email, at: new Date().toISOString() }]
        : internalNotes;
      const patch: any = {
        status, decision_reason: decisionReason || null,
        return_shipping_carrier: carrier || null, return_tracking_number: tracking || null,
        refund_amount: Number(refundAmount) || 0, shipping_fee_deducted: Number(shippingDeducted) || 0,
        internal_notes: newNotes,
      };
      if (["approved", "rejected"].includes(status) && !req.reviewed_at) {
        patch.reviewed_by = user?.id; patch.reviewed_by_email = user?.email; patch.reviewed_at = new Date().toISOString();
      }
      if (status === "refunded") patch.refunded_at = new Date().toISOString();
      if (status === "closed") patch.closed_at = new Date().toISOString();
      const { error } = await supabase.from("return_requests").update(patch).eq("id", req.id);
      if (error) throw error;
      if (status === "received" && req.status !== "received") {
        await restockItems(req.id);
      }
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateInspection(itemId: string, patch: any) {
    await supabase.from("return_items").update(patch).eq("id", itemId);
    const { data } = await supabase.from("return_items").select("*").eq("return_request_id", req.id);
    setItems(data ?? []);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div dir="rtl" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{req.return_number}</h2>
            <p className="text-xs text-muted-foreground">طلب: {req.order_number} • {req.customer_email}</p>
          </div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="السبب">
            <p className="text-sm font-medium">{req.reason}</p>
            {req.reason_details && <p className="mt-1 text-xs text-muted-foreground">{req.reason_details}</p>}
          </Section>
          <Section title="طريقة الاسترداد">
            <p className="text-sm">{req.refund_method}</p>
          </Section>
        </div>

        {req.customer_notes && (
          <Section title="ملاحظات العميل"><p className="text-sm">{req.customer_notes}</p></Section>
        )}

        {(req.photos ?? []).length > 0 && (
          <Section title="الصور">
            <div className="flex flex-wrap gap-2">
              {(req.photos as string[]).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" className="h-24 w-24 rounded object-cover" />
                </a>
              ))}
            </div>
          </Section>
        )}

        <Section title={<><Package className="inline h-3.5 w-3.5"/> المنتجات المرتجعة</>}>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="rounded-md border border-border p-2 text-sm">
                <div className="flex justify-between">
                  <span>{it.product_name} × {it.qty}</span>
                  <span>{Number(it.unit_price).toFixed(0)} ر.س</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={it.inspection_status ?? "pending"} onChange={(e) => updateInspection(it.id, { inspection_status: e.target.value })}
                    className="rounded border border-border bg-background px-2 py-0.5 text-xs">
                    <option value="pending">قيد الفحص</option>
                    <option value="ok">سليم</option>
                    <option value="damaged">تالف</option>
                    <option value="missing_parts">ناقص قطع</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={it.restock} onChange={(e) => updateInspection(it.id, { restock: e.target.checked })} />
                    إعادة للمخزون
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="القرار والحالة">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">الحالة</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as ReturnStatus)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                {RETURN_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">سبب القرار</span>
              <input value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground"><Truck className="inline h-3 w-3"/> ناقل شحنة الإرجاع</span>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">رقم تتبع الإرجاع</span>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground"><Wallet className="inline h-3 w-3"/> مبلغ الاسترداد</span>
              <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">رسوم شحن مخصومة</span>
              <input type="number" value={shippingDeducted} onChange={(e) => setShippingDeducted(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
          </div>
          {req.reviewed_by_email && <p className="mt-2 text-xs text-muted-foreground">راجعها: {req.reviewed_by_email} • {new Date(req.reviewed_at).toLocaleString("ar")}</p>}
        </Section>

        <Section title={<><MessageSquare className="inline h-3.5 w-3.5"/> ملاحظات داخلية</>}>
          <div className="mb-2 space-y-1 max-h-40 overflow-auto">
            {internalNotes.map((n: any, i: number) => (
              <div key={i} className="rounded bg-muted/40 p-2 text-xs">
                <p>{n.text}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{n.by} • {new Date(n.at).toLocaleString("ar")}</p>
              </div>
            ))}
          </div>
          <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="أضف ملاحظة..." rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
        </Section>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">إغلاق</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function SettingsPanel() {
  const [s, setS] = useState<any>(null);
  const [nr, setNr] = useState<any[]>([]);
  const [newProductId, setNewProductId] = useState("");
  const [newReason, setNewReason] = useState("");

  async function load() {
    const [{ data: settings }, { data: nrList }] = await Promise.all([
      supabase.from("return_settings").select("*").maybeSingle(),
      supabase.from("non_returnable_products").select("*, products(name_ar, name_en)"),
    ]);
    setS(settings); setNr(nrList ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!s?.id) return;
    const { error } = await supabase.from("return_settings").update({
      return_window_days: Number(s.return_window_days),
      deduct_shipping_fee: s.deduct_shipping_fee,
      shipping_fee_amount: Number(s.shipping_fee_amount),
      reasons: s.reasons, refund_methods: s.refund_methods,
      policy_text_ar: s.policy_text_ar, policy_text_en: s.policy_text_en,
    }).eq("id", s.id);
    if (error) alert(error.message); else alert("تم الحفظ");
  }

  async function addNonReturnable() {
    if (!newProductId) return;
    await supabase.from("non_returnable_products").insert({ product_id: newProductId, reason: newReason || null });
    setNewProductId(""); setNewReason(""); await load();
  }

  if (!s) return <div className="rounded-xl border border-border p-6 text-center text-sm">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">قواعد الاسترجاع</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">مدة السماح (أيام)</span>
            <input type="number" value={s.return_window_days ?? 14} onChange={(e) => setS({ ...s, return_window_days: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={s.deduct_shipping_fee ?? false} onChange={(e) => setS({ ...s, deduct_shipping_fee: e.target.checked })} />
            خصم رسوم الشحن من المبلغ المسترد
          </label>
          {s.deduct_shipping_fee && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">قيمة رسوم الشحن المخصومة</span>
              <input type="number" value={s.shipping_fee_amount ?? 0} onChange={(e) => setS({ ...s, shipping_fee_amount: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
          )}
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">أسباب الاسترجاع (مفصولة بفواصل)</span>
            <input value={(s.reasons ?? []).join(",")} onChange={(e) => setS({ ...s, reasons: e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean) })}
              className="w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">نص السياسة (عربي)</span>
            <textarea rows={3} value={s.policy_text_ar ?? ""} onChange={(e) => setS({ ...s, policy_text_ar: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2" />
          </label>
        </div>
        <button onClick={save} className="mt-3 flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          <Save className="h-4 w-4"/> حفظ الإعدادات
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 font-semibold">منتجات غير قابلة للاسترجاع</h3>
        <div className="mb-3 flex gap-2">
          <input value={newProductId} onChange={(e) => setNewProductId(e.target.value)} placeholder="معرف المنتج (UUID)"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
          <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="السبب (اختياري)"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={addNonReturnable} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">إضافة</button>
        </div>
        <div className="space-y-1">
          {nr.map((x: any) => (
            <div key={x.product_id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
              <div>
                <div>{x.products?.name_ar ?? x.product_id}</div>
                {x.reason && <div className="text-xs text-muted-foreground">{x.reason}</div>}
              </div>
              <button onClick={async () => { await supabase.from("non_returnable_products").delete().eq("product_id", x.product_id); await load(); }}
                className="text-xs text-destructive">حذف</button>
            </div>
          ))}
          {nr.length === 0 && <p className="text-xs text-muted-foreground">لا توجد منتجات</p>}
        </div>
      </div>
    </div>
  );
}
