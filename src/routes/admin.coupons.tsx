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
    if (!editing?.code) return alert("الكود مطلوب");
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
    if (!confirm("حذف هذا الكوبون؟")) return;
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
          <h1 className="text-xl font-semibold">العروض والكوبونات</h1>
          <p className="text-xs text-muted-foreground">إجمالي: {list.length} • النشط: {list.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date())).length}</p>
        </div>
        <button onClick={() => setEditing({ ...blank })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> عرض جديد
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "active", "expired", "auto"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {f === "all" ? "الكل" : f === "active" ? "النشط" : f === "expired" ? "المنتهي" : "تلقائي"}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..."
          className="ml-auto rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
      </div>

      {editing && <CouponEditor editing={editing} setEditing={setEditing} save={save} genCode={genCode} />}
      {stats && <StatsModal coupon={stats} onClose={() => setStats(null)} />}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-3">الاسم/الكود</th>
              <th className="p-3">النوع</th>
              <th className="p-3">القيمة</th>
              <th className="p-3">الاستخدام</th>
              <th className="p-3">الإيراد</th>
              <th className="p-3">الصلاحية</th>
              <th className="p-3">الحالة</th>
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
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{labelType(c.discount_type)}</span>
                    {c.auto_apply && <span className="mr-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-800">تلقائي</span>}
                  </td>
                  <td className="p-3 text-xs">{valueLabel(c)}</td>
                  <td className="p-3 text-xs">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                  <td className="p-3 text-xs">{Number(c.revenue_total ?? 0).toFixed(0)} ر.س</td>
                  <td className="p-3 text-[11px]">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar") : "—"}</td>
                  <td className="p-3">
                    <button onClick={() => toggle(c)} className={`rounded-full px-2 py-0.5 text-[10px] ${
                      !c.is_active ? "bg-gray-100 text-gray-700" : expired ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                    }`}>
                      {!c.is_active ? "معطل" : expired ? "منتهي" : "نشط"}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setStats(c)} className="rounded p-1.5 hover:bg-muted" title="تقرير الأداء"><BarChart3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditing(c)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(c.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">لا توجد عروض</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function labelType(t: string) {
  return ({
    percent: "نسبة %", fixed: "ثابت", free_shipping: "شحن مجاني",
    bxgy: "اشترِ X واحصل Y", bundle: "حزمة",
  } as any)[t] || t;
}

function valueLabel(c: Coupon) {
  if (c.discount_type === "percent") return `${c.discount_value}%`;
  if (c.discount_type === "fixed") return `${c.discount_value} ر.س`;
  if (c.discount_type === "free_shipping") return "شحن مجاني";
  if (c.discount_type === "bxgy") return `B${c.bxgy_config?.buy_qty ?? 1} G${c.bxgy_config?.get_qty ?? 1}`;
  if (c.discount_type === "bundle") return `${c.bundle_config?.bundle_price ?? 0} ر.س`;
  return "—";
}

function CouponEditor({ editing, setEditing, save, genCode }: any) {
  const [tab, setTab] = useState<"basic" | "conditions" | "scope" | "advanced">("basic");
  const e = editing;
  const set = (patch: any) => setEditing({ ...e, ...patch });
  const setCfg = (key: string, patch: any) => setEditing({ ...e, [key]: { ...(e[key] ?? {}), ...patch } });
  const csv = (arr: any) => (Array.isArray(arr) ? arr.join(",") : "");
  const fromCsv = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {(["basic", "conditions", "scope", "advanced"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs ${tab === t ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>
            {t === "basic" ? "أساسي" : t === "conditions" ? "الشروط" : t === "scope" ? "النطاق" : "متقدم"}
          </button>
        ))}
      </div>

      {tab === "basic" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="اسم العرض" value={e.name ?? ""} onChange={(v) => set({ name: v })} />
          <div className="flex gap-2 items-end">
            <Input label="الكود" value={e.code ?? ""} onChange={(v) => set({ code: v.toUpperCase() })} />
            <button onClick={genCode} type="button" className="h-9 rounded-md border border-border px-2 text-xs"><Tag className="h-3.5 w-3.5"/></button>
          </div>
          <Select label="نوع العرض" value={e.offer_type ?? "coupon"} onChange={(v) => set({ offer_type: v })}
            options={[
              ["coupon", "كوبون عام"],
              ["first_order", "خصم لأول طلب"],
              ["free_shipping", "شحن مجاني"],
              ["bxgy", "اشترِ X واحصل Y"],
              ["bundle", "حزمة Bundle"],
              ["category", "خصم على قسم"],
              ["product", "خصم على منتج"],
              ["city", "خصم حسب المدينة"],
              ["threshold", "خصم عند تجاوز مبلغ"],
            ]} />
          <Select label="نوع الخصم" value={e.discount_type ?? "percent"} onChange={(v) => set({ discount_type: v })}
            options={[
              ["percent", "نسبة %"],
              ["fixed", "مبلغ ثابت"],
              ["free_shipping", "شحن مجاني"],
              ["bxgy", "BXGY"],
              ["bundle", "حزمة"],
            ]} />
          {(e.discount_type === "percent" || e.discount_type === "fixed") && (
            <Input label="قيمة الخصم" type="number" value={String(e.discount_value ?? 0)} onChange={(v) => set({ discount_value: Number(v) })} />
          )}
          <Input label="وصف" value={e.description ?? ""} onChange={(v) => set({ description: v })} />

          {e.discount_type === "bxgy" && (
            <>
              <Input label="اشترِ (qty)" type="number" value={String(e.bxgy_config?.buy_qty ?? 1)} onChange={(v) => setCfg("bxgy_config", { buy_qty: Number(v) })} />
              <Input label="احصل (qty)" type="number" value={String(e.bxgy_config?.get_qty ?? 1)} onChange={(v) => setCfg("bxgy_config", { get_qty: Number(v) })} />
              <Input label="نسبة الخصم على المجاني %" type="number" value={String(e.bxgy_config?.get_discount_percent ?? 100)} onChange={(v) => setCfg("bxgy_config", { get_discount_percent: Number(v) })} />
            </>
          )}
          {e.discount_type === "bundle" && (
            <>
              <Input label="معرفات المنتجات في الحزمة (مفصولة بفواصل)" value={csv(e.bundle_config?.product_ids)} onChange={(v) => setCfg("bundle_config", { product_ids: fromCsv(v) })} />
              <Input label="سعر الحزمة" type="number" value={String(e.bundle_config?.bundle_price ?? 0)} onChange={(v) => setCfg("bundle_config", { bundle_price: Number(v) })} />
            </>
          )}
        </div>
      )}

      {tab === "conditions" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="تاريخ البدء" type="datetime-local" value={e.starts_at?.slice(0, 16) ?? ""} onChange={(v) => set({ starts_at: v })} />
          <Input label="تاريخ الانتهاء" type="datetime-local" value={e.expires_at?.slice(0, 16) ?? ""} onChange={(v) => set({ expires_at: v })} />
          <Input label="الحد الأدنى للسلة" type="number" value={String(e.min_subtotal ?? "")} onChange={(v) => set({ min_subtotal: v ? Number(v) : null })} />
          <Input label="الحد الأقصى للاستخدام (إجمالاً)" type="number" value={String(e.max_uses ?? "")} onChange={(v) => set({ max_uses: v ? Number(v) : null })} />
          <Input label="حد الاستخدام لكل عميل" type="number" value={String(e.per_customer_limit ?? "")} onChange={(v) => set({ per_customer_limit: v ? Number(v) : null })} />
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={e.first_order_only ?? false} onChange={(ev) => set({ first_order_only: ev.target.checked })} />
            للطلب الأول فقط
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={e.no_combine ?? false} onChange={(ev) => set({ no_combine: ev.target.checked })} />
            لا يُجمع مع كوبونات أخرى
          </label>
        </div>
      )}

      {tab === "scope" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="منتجات مشمولة (IDs مفصولة بفواصل)" value={csv(e.included_product_ids)} onChange={(v) => set({ included_product_ids: fromCsv(v) })} />
          <Input label="منتجات مستثناة" value={csv(e.excluded_product_ids)} onChange={(v) => set({ excluded_product_ids: fromCsv(v) })} />
          <Input label="أقسام مشمولة (IDs)" value={csv(e.included_category_ids)} onChange={(v) => set({ included_category_ids: fromCsv(v) })} />
          <Input label="مدن مسموحة" value={csv(e.allowed_cities)} onChange={(v) => set({ allowed_cities: fromCsv(v) })} />
          <Input label="طرق دفع مسموحة (cod, card, ...)" value={csv(e.allowed_payment_methods)} onChange={(v) => set({ allowed_payment_methods: fromCsv(v) })} />
          <Input label="مناطق شحن مسموحة (zone IDs)" value={csv(e.allowed_shipping_zones)} onChange={(v) => set({ allowed_shipping_zones: fromCsv(v) })} />
          <Input label="عملاء محددون (user IDs)" value={csv(e.allowed_user_ids)} onChange={(v) => set({ allowed_user_ids: fromCsv(v) })} />
        </div>
      )}

      {tab === "advanced" && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.is_active ?? true} onChange={(ev) => set({ is_active: ev.target.checked })} />
            نشط
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.auto_apply ?? false} onChange={(ev) => set({ auto_apply: ev.target.checked })} />
            تطبيق تلقائي بدون كود
          </label>
          <Input label="الأولوية (الأقل أولاً)" type="number" value={String(e.priority ?? 100)} onChange={(v) => set({ priority: Number(v) })} />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Save className="h-3.5 w-3.5" /> حفظ</button>
        <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" /> إلغاء</button>
      </div>
    </div>
  );
}

function StatsModal({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  const [redemptions, setRedemptions] = useState<any[]>([]);
  useEffect(() => {
    void supabase.from("coupon_redemptions").select("*").eq("coupon_id", coupon.id)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setRedemptions(data ?? []));
  }, [coupon.id]);

  const avgDiscount = redemptions.length ? redemptions.reduce((s, r) => s + Number(r.discount_amount), 0) / redemptions.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">تقرير: {coupon.name || coupon.code}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="استخدامات" value={String(coupon.used_count)} />
          <Stat label="إجمالي الإيراد" value={`${Number(coupon.revenue_total).toFixed(0)} ر.س`} />
          <Stat label="إجمالي الخصم" value={`${Number(coupon.discount_total).toFixed(0)} ر.س`} />
          <Stat label="متوسط الخصم" value={`${avgDiscount.toFixed(0)} ر.س`} />
        </div>
        <h3 className="mb-2 text-sm font-semibold">آخر 50 استخداماً</h3>
        <table className="w-full text-xs">
          <thead className="text-right text-muted-foreground"><tr><th className="p-2">التاريخ</th><th>العميل</th><th>الخصم</th><th>الإجمالي</th></tr></thead>
          <tbody>
            {redemptions.map(r => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-2">{new Date(r.created_at).toLocaleString("ar")}</td>
                <td>{r.customer_email || r.user_id?.slice(0,8) || "—"}</td>
                <td>{Number(r.discount_amount).toFixed(0)}</td>
                <td>{Number(r.order_total).toFixed(0)}</td>
              </tr>
            ))}
            {redemptions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">لا توجد استخدامات بعد</td></tr>}
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
