import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useTr, type TrFn } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
import { Plus, Trash2, Pencil, Save, X, Copy, BarChart3, Tag } from "lucide-react";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsAdmin,
});

type Coupon = {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  offer_type: string;
  discount_type: string;
  discount_value: number;
  min_subtotal: number | null;
  max_uses: number | null;
  per_customer_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  auto_apply: boolean;
  first_order_only: boolean;
  no_combine: boolean;
  priority: number;
  bxgy_config: any;
  bundle_config: any;
  allowed_user_ids: any;
  allowed_cities: any;
  allowed_payment_methods: any;
  allowed_shipping_zones: any;
  included_product_ids: any;
  excluded_product_ids: any;
  included_category_ids: any;
  revenue_total: number;
  discount_total: number;
};

const blank: Partial<Coupon> = {
  code: "",
  name: "",
  offer_type: "coupon",
  discount_type: "percent",
  discount_value: 10,
  is_active: true,
  auto_apply: false,
  first_order_only: false,
  no_combine: false,
  priority: 100,
  bxgy_config: { buy_qty: 1, get_qty: 1, get_discount_percent: 100 },
  bundle_config: { product_ids: [], bundle_price: 0 },
  allowed_user_ids: [],
  allowed_cities: [],
  allowed_payment_methods: [],
  allowed_shipping_zones: [],
  included_product_ids: [],
  excluded_product_ids: [],
  included_category_ids: [],
};

function CouponsAdmin() {
  const tr = useTr();
  const { lang } = useLanguage();
  const [list, setList] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);
  const [stats, setStats] = useState<Coupon | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "auto">("all");
  const [search, setSearch] = useState("");

  async function load() {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Coupon[]);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return list.filter((c) => {
      const expired = c.expires_at && new Date(c.expires_at) < new Date();
      if (filter === "active" && (!c.is_active || expired)) return false;
      if (filter === "expired" && !expired) return false;
      if (filter === "auto" && !c.auto_apply) return false;
      if (search && !`${c.code} ${c.name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [list, filter, search]);

  async function save() {
    if (!editing?.code) return alert(tr("الكود مطلوب", "Code is required"));
    const payload: any = {
      code: editing.code.toUpperCase().trim(),
      name: editing.name || null,
      description: editing.description ?? null,
      offer_type: editing.offer_type ?? "coupon",
      discount_type: editing.discount_type ?? "percent",
      discount_value: Number(editing.discount_value ?? 0),
      min_subtotal: editing.min_subtotal ? Number(editing.min_subtotal) : null,
      max_uses: editing.max_uses ? Number(editing.max_uses) : null,
      per_customer_limit: editing.per_customer_limit ? Number(editing.per_customer_limit) : null,
      starts_at: editing.starts_at || null,
      expires_at: editing.expires_at || null,
      is_active: editing.is_active ?? true,
      auto_apply: editing.auto_apply ?? false,
      first_order_only: editing.first_order_only ?? false,
      no_combine: editing.no_combine ?? false,
      priority: Number(editing.priority ?? 100),
      bxgy_config: editing.bxgy_config ?? {},
      bundle_config: editing.bundle_config ?? {},
      allowed_user_ids: editing.allowed_user_ids ?? [],
      allowed_cities: editing.allowed_cities ?? [],
      allowed_payment_methods: editing.allowed_payment_methods ?? [],
      allowed_shipping_zones: editing.allowed_shipping_zones ?? [],
      included_product_ids: editing.included_product_ids ?? [],
      excluded_product_ids: editing.excluded_product_ids ?? [],
      included_category_ids: editing.included_category_ids ?? [],
    };
    const { error } = editing.id
      ? await supabase.from("coupons").update(payload).eq("id", editing.id)
      : await supabase.from("coupons").insert(payload);
    if (error) return alert(error.message);
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(tr("حذف هذا الكوبون؟", "Delete this coupon?"))) return;
    await supabase.from("coupons").delete().eq("id", id);
    await load();
  }

  async function toggle(c: Coupon) {
    await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    await load();
  }

  function genCode() {
    const code = "SAVE" + Math.random().toString(36).slice(2, 7).toUpperCase();
    setEditing((e) => ({ ...(e ?? {}), code }));
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{tr("العروض والكوبونات", "Offers & Coupons")}</h1>
          <p className="text-xs text-muted-foreground">{tr("إجمالي:", "Total:")} {list.length} • {tr("النشط:", "Active:")} {list.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date())).length}</p>
        </div>
        <button onClick={() => setEditing({ ...blank })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> {tr("عرض جديد", "New offer")}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "active", "expired", "auto"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {f === "all" ? tr("الكل", "All") : f === "active" ? tr("النشط", "Active") : f === "expired" ? tr("المنتهي", "Expired") : tr("تلقائي", "Auto")}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث...", "Search...")}
          className="ml-auto rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
      </div>

      {editing && <CouponEditor editing={editing} setEditing={setEditing} save={save} genCode={genCode} tr={tr} />}
      {stats && <StatsModal coupon={stats} onClose={() => setStats(null)} tr={tr} lang={lang} />}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-3">{tr("الاسم/الكود", "Name/Code")}</th>
              <th className="p-3">{tr("النوع", "Type")}</th>
              <th className="p-3">{tr("القيمة", "Value")}</th>
              <th className="p-3">{tr("الاستخدام", "Usage")}</th>
              <th className="p-3">{tr("الإيراد", "Revenue")}</th>
              <th className="p-3">{tr("الصلاحية", "Expires")}</th>
              <th className="p-3">{tr("الحالة", "Status")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              return (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-medium">{c.name || c.code}</div>
                    <button onClick={() => navigator.clipboard.writeText(c.code)} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary">
                      {c.code} <Copy className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{labelType(c.discount_type, tr)}</span>
                    {c.auto_apply && <span className="mr-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-800">{tr("تلقائي", "Auto")}</span>}
                  </td>
                  <td className="p-3 text-xs">{valueLabel(c, tr)}</td>
                  <td className="p-3 text-xs">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                  <td className="p-3 text-xs">{Number(c.revenue_total ?? 0).toFixed(0)} {tr("ر.س", "SAR")}</td>
                  <td className="p-3 text-[11px]">{c.expires_at ? new Date(c.expires_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US") : "—"}</td>
                  <td className="p-3">
                    <button onClick={() => toggle(c)} className={`rounded-full px-2 py-0.5 text-[10px] ${
                      !c.is_active ? "bg-gray-100 text-gray-700" : expired ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                    }`}>
                      {!c.is_active ? tr("معطل", "Disabled") : expired ? tr("منتهي", "Expired") : tr("نشط", "Active")}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setStats(c)} className="rounded p-1.5 hover:bg-muted" title={tr("تقرير الأداء", "Performance report")}><BarChart3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditing(c)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(c.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">{tr("لا توجد عروض", "No offers")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function labelType(t: string, tr: TrFn) {
  return ({
    percent: tr("نسبة %", "Percent %"),
    fixed: tr("ثابت", "Fixed"),
    free_shipping: tr("شحن مجاني", "Free shipping"),
    bxgy: tr("اشترِ X واحصل Y", "Buy X get Y"),
    bundle: tr("حزمة", "Bundle"),
  } as any)[t] || t;
}

function valueLabel(c: Coupon, tr: TrFn) {
  if (c.discount_type === "percent") return `${c.discount_value}%`;
  if (c.discount_type === "fixed") return `${c.discount_value} ${tr("ر.س", "SAR")}`;
  if (c.discount_type === "free_shipping") return tr("شحن مجاني", "Free shipping");
  if (c.discount_type === "bxgy") return `B${c.bxgy_config?.buy_qty ?? 1} G${c.bxgy_config?.get_qty ?? 1}`;
  if (c.discount_type === "bundle") return `${c.bundle_config?.bundle_price ?? 0} ${tr("ر.س", "SAR")}`;
  return "—";
}

function CouponEditor({ editing, setEditing, save, genCode, tr }: any) {
  const [tab, setTab] = useState<"basic" | "conditions" | "scope" | "advanced">("basic");
  const e = editing;
  const set = (patch: any) => setEditing({ ...e, ...patch });
  const setCfg = (key: string, patch: any) => setEditing({ ...e, [key]: { ...(e[key] ?? {}), ...patch } });
  const csv = (arr: any) => (Array.isArray(arr) ? arr.join(",") : "");
  const fromCsv = (v: string) => v.split(",").map((s: string) => s.trim()).filter(Boolean);

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {(["basic", "conditions", "scope", "advanced"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs ${tab === t ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>
            {t === "basic" ? tr("أساسي", "Basic") : t === "conditions" ? tr("الشروط", "Conditions") : t === "scope" ? tr("النطاق", "Scope") : tr("متقدم", "Advanced")}
          </button>
        ))}
      </div>

      {tab === "basic" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label={tr("اسم العرض", "Offer name")} value={e.name ?? ""} onChange={(v: string) => set({ name: v })} />
          <div className="flex gap-2 items-end">
            <Input label={tr("الكود", "Code")} value={e.code ?? ""} onChange={(v: string) => set({ code: v.toUpperCase() })} />
            <button onClick={genCode} type="button" className="h-9 rounded-md border border-border px-2 text-xs"><Tag className="h-3.5 w-3.5"/></button>
          </div>
          <Select label={tr("نوع العرض", "Offer type")} value={e.offer_type ?? "coupon"} onChange={(v: string) => set({ offer_type: v })}
            options={[
              ["coupon", tr("كوبون عام", "General coupon")],
              ["first_order", tr("خصم لأول طلب", "First order discount")],
              ["free_shipping", tr("شحن مجاني", "Free shipping")],
              ["bxgy", tr("اشترِ X واحصل Y", "Buy X get Y")],
              ["bundle", tr("حزمة Bundle", "Bundle")],
              ["category", tr("خصم على قسم", "Category discount")],
              ["product", tr("خصم على منتج", "Product discount")],
              ["city", tr("خصم حسب المدينة", "City discount")],
              ["threshold", tr("خصم عند تجاوز مبلغ", "Threshold discount")],
            ]} />
          <Select label={tr("نوع الخصم", "Discount type")} value={e.discount_type ?? "percent"} onChange={(v: string) => set({ discount_type: v })}
            options={[
              ["percent", tr("نسبة %", "Percent %")],
              ["fixed", tr("مبلغ ثابت", "Fixed amount")],
              ["free_shipping", tr("شحن مجاني", "Free shipping")],
              ["bxgy", "BXGY"],
              ["bundle", tr("حزمة", "Bundle")],
            ]} />
          {(e.discount_type === "percent" || e.discount_type === "fixed") && (
            <Input label={tr("قيمة الخصم", "Discount value")} type="number" value={String(e.discount_value ?? 0)} onChange={(v: string) => set({ discount_value: Number(v) })} />
          )}
          <Input label={tr("وصف", "Description")} value={e.description ?? ""} onChange={(v: string) => set({ description: v })} />

          {e.discount_type === "bxgy" && (
            <>
              <Input label={tr("اشترِ (qty)", "Buy (qty)")} type="number" value={String(e.bxgy_config?.buy_qty ?? 1)} onChange={(v: string) => setCfg("bxgy_config", { buy_qty: Number(v) })} />
              <Input label={tr("احصل (qty)", "Get (qty)")} type="number" value={String(e.bxgy_config?.get_qty ?? 1)} onChange={(v: string) => setCfg("bxgy_config", { get_qty: Number(v) })} />
              <Input label={tr("نسبة الخصم على المجاني %", "Discount on free items %")} type="number" value={String(e.bxgy_config?.get_discount_percent ?? 100)} onChange={(v: string) => setCfg("bxgy_config", { get_discount_percent: Number(v) })} />
            </>
          )}
          {e.discount_type === "bundle" && (
            <>
              <Input label={tr("معرفات المنتجات في الحزمة (مفصولة بفواصل)", "Bundle product IDs (comma-separated)")} value={csv(e.bundle_config?.product_ids)} onChange={(v: string) => setCfg("bundle_config", { product_ids: fromCsv(v) })} />
              <Input label={tr("سعر الحزمة", "Bundle price")} type="number" value={String(e.bundle_config?.bundle_price ?? 0)} onChange={(v: string) => setCfg("bundle_config", { bundle_price: Number(v) })} />
            </>
          )}
        </div>
      )}

      {tab === "conditions" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label={tr("تاريخ البدء", "Start date")} type="datetime-local" value={e.starts_at?.slice(0, 16) ?? ""} onChange={(v: string) => set({ starts_at: v })} />
          <Input label={tr("تاريخ الانتهاء", "Expiry date")} type="datetime-local" value={e.expires_at?.slice(0, 16) ?? ""} onChange={(v: string) => set({ expires_at: v })} />
          <Input label={tr("الحد الأدنى للسلة", "Minimum subtotal")} type="number" value={String(e.min_subtotal ?? "")} onChange={(v: string) => set({ min_subtotal: v ? Number(v) : null })} />
          <Input label={tr("الحد الأقصى للاستخدام (إجمالاً)", "Max uses (total)")} type="number" value={String(e.max_uses ?? "")} onChange={(v: string) => set({ max_uses: v ? Number(v) : null })} />
          <Input label={tr("حد الاستخدام لكل عميل", "Per-customer limit")} type="number" value={String(e.per_customer_limit ?? "")} onChange={(v: string) => set({ per_customer_limit: v ? Number(v) : null })} />
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={e.first_order_only ?? false} onChange={(ev) => set({ first_order_only: ev.target.checked })} />
            {tr("للطلب الأول فقط", "First order only")}
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={e.no_combine ?? false} onChange={(ev) => set({ no_combine: ev.target.checked })} />
            {tr("لا يُجمع مع كوبونات أخرى", "Cannot combine with other coupons")}
          </label>
        </div>
      )}

      {tab === "scope" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label={tr("منتجات مشمولة (IDs مفصولة بفواصل)", "Included products (comma-separated IDs)")} value={csv(e.included_product_ids)} onChange={(v: string) => set({ included_product_ids: fromCsv(v) })} />
          <Input label={tr("منتجات مستثناة", "Excluded products")} value={csv(e.excluded_product_ids)} onChange={(v: string) => set({ excluded_product_ids: fromCsv(v) })} />
          <Input label={tr("أقسام مشمولة (IDs)", "Included categories (IDs)")} value={csv(e.included_category_ids)} onChange={(v: string) => set({ included_category_ids: fromCsv(v) })} />
          <Input label={tr("مدن مسموحة", "Allowed cities")} value={csv(e.allowed_cities)} onChange={(v: string) => set({ allowed_cities: fromCsv(v) })} />
          <Input label={tr("طرق دفع مسموحة (cod, card, ...)", "Allowed payment methods (cod, card, ...)")} value={csv(e.allowed_payment_methods)} onChange={(v: string) => set({ allowed_payment_methods: fromCsv(v) })} />
          <Input label={tr("مناطق شحن مسموحة (zone IDs)", "Allowed shipping zones (zone IDs)")} value={csv(e.allowed_shipping_zones)} onChange={(v: string) => set({ allowed_shipping_zones: fromCsv(v) })} />
          <Input label={tr("عملاء محددون (user IDs)", "Specific customers (user IDs)")} value={csv(e.allowed_user_ids)} onChange={(v: string) => set({ allowed_user_ids: fromCsv(v) })} />
        </div>
      )}

      {tab === "advanced" && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.is_active ?? true} onChange={(ev) => set({ is_active: ev.target.checked })} />
            {tr("نشط", "Active")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.auto_apply ?? false} onChange={(ev) => set({ auto_apply: ev.target.checked })} />
            {tr("تطبيق تلقائي بدون كود", "Auto-apply without code")}
          </label>
          <Input label={tr("الأولوية (الأقل أولاً)", "Priority (lowest first)")} type="number" value={String(e.priority ?? 100)} onChange={(v: string) => set({ priority: Number(v) })} />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Save className="h-3.5 w-3.5" /> {tr("حفظ", "Save")}</button>
        <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" /> {tr("إلغاء", "Cancel")}</button>
      </div>
    </div>
  );
}

function StatsModal({ coupon, onClose, tr, lang }: { coupon: Coupon; onClose: () => void; tr: TrFn; lang: string }) {
  const [redemptions, setRedemptions] = useState<any[]>([]);
  useEffect(() => {
    void supabase.from("coupon_redemptions").select("*").eq("coupon_id", coupon.id)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setRedemptions(data ?? []));
  }, [coupon.id]);

  const avgDiscount = redemptions.length ? redemptions.reduce((s, r) => s + Number(r.discount_amount), 0) / redemptions.length : 0;
  const sar = tr("ر.س", "SAR");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tr("تقرير:", "Report:")} {coupon.name || coupon.code}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={tr("استخدامات", "Uses")} value={String(coupon.used_count)} />
          <Stat label={tr("إجمالي الإيراد", "Total revenue")} value={`${Number(coupon.revenue_total).toFixed(0)} ${sar}`} />
          <Stat label={tr("إجمالي الخصم", "Total discount")} value={`${Number(coupon.discount_total).toFixed(0)} ${sar}`} />
          <Stat label={tr("متوسط الخصم", "Avg discount")} value={`${avgDiscount.toFixed(0)} ${sar}`} />
        </div>
        <h3 className="mb-2 text-sm font-semibold">{tr("آخر 50 استخداماً", "Last 50 redemptions")}</h3>
        <table className="w-full text-xs">
          <thead className="text-right text-muted-foreground"><tr><th className="p-2">{tr("التاريخ", "Date")}</th><th>{tr("العميل", "Customer")}</th><th>{tr("الخصم", "Discount")}</th><th>{tr("الإجمالي", "Total")}</th></tr></thead>
          <tbody>
            {redemptions.map(r => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-2">{new Date(r.created_at).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}</td>
                <td>{r.customer_email || r.user_id?.slice(0,8) || "—"}</td>
                <td>{Number(r.discount_amount).toFixed(0)}</td>
                <td>{Number(r.order_total).toFixed(0)}</td>
              </tr>
            ))}
            {redemptions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{tr("لا توجد استخدامات بعد", "No redemptions yet")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
