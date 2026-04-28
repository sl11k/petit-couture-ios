import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { logAudit } from "@/lib/audit";
import { Star, Package, Gift, Users, Globe, BarChart3, Search, Save } from "lucide-react";

export const Route = createFileRoute("/admin/conversion")({ component: ConversionAdmin });

const TABS = [
  { id: "reviews", label: "التقييمات", icon: Star },
  { id: "bundles", label: "الحزم Bundles", icon: Package },
  { id: "loyalty", label: "الولاء والنقاط", icon: Gift },
  { id: "referrals", label: "الإحالات", icon: Users },
  { id: "landing", label: "Landing Pages", icon: Globe },
  { id: "ab", label: "A/B Testing", icon: BarChart3 },
  { id: "search", label: "البحث الداخلي", icon: Search },
] as const;

type TabId = typeof TABS[number]["id"];

function ConversionAdmin() {
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("storefront.manage") || can("products.manage");
  const [tab, setTab] = useState<TabId>("reviews");

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">تحسين المبيعات والتحويل</h1>
        <p className="text-xs text-muted-foreground">إدارة كل أدوات زيادة التحويل والمبيعات في مكان واحد</p>
      </div>

      {!allowed && (
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-50/50 p-3 text-xs text-amber-800">
          أنت تشاهد فقط — التعديل يتطلب صلاحية إدارة المنتجات أو الواجهات.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-border pb-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${tab === t.id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "reviews" && <ReviewsTab allowed={allowed} />}
      {tab === "bundles" && <BundlesTab allowed={allowed} />}
      {tab === "loyalty" && <LoyaltyTab allowed={allowed} />}
      {tab === "referrals" && <ReferralsTab allowed={allowed} />}
      {tab === "landing" && <LandingTab allowed={allowed} />}
      {tab === "ab" && <ABTestsTab allowed={allowed} />}
      {tab === "search" && <SearchTab allowed={allowed} />}
    </AdminShell>
  );
}

// ===== Reviews =====
function ReviewsTab({ allowed }: { allowed: boolean }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending"|"approved"|"rejected"|"all">("pending");

  async function load() {
    let q = supabase.from("reviews").select("*, products(name_ar, image_url)").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setReviews(data ?? []);
  }
  useEffect(() => { void load(); }, [filter]);

  async function setStatus(id: string, status: string) {
    await supabase.from("reviews").update({ status }).eq("id", id);
    await logAudit({ action: "review.moderate", entity: "review", entity_id: id, metadata: { status } });
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["pending","approved","rejected","all"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-md border px-3 py-1 text-xs ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {s === "pending" ? "قيد المراجعة" : s === "approved" ? "مقبولة" : s === "rejected" ? "مرفوضة" : "الكل"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{r.products?.name_ar ?? "—"}</span>
                  <span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.verified_purchase && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">شراء موثّق</span>}
                </div>
                <p className="text-[11px] text-muted-foreground">{r.customer_name ?? "مستخدم"} — {new Date(r.created_at).toLocaleDateString("ar")}</p>
              </div>
              {allowed && (
                <div className="flex gap-1">
                  {r.status !== "approved" && <button onClick={() => setStatus(r.id, "approved")} className="rounded bg-emerald-100 px-2 py-1 text-[10px] text-emerald-700">قبول</button>}
                  {r.status !== "rejected" && <button onClick={() => setStatus(r.id, "rejected")} className="rounded bg-rose-100 px-2 py-1 text-[10px] text-rose-700">رفض</button>}
                </div>
              )}
            </div>
            {r.title && <p className="text-xs font-semibold">{r.title}</p>}
            {r.body && <p className="mt-1 text-xs text-muted-foreground">{r.body}</p>}
          </div>
        ))}
        {reviews.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">لا توجد تقييمات</p>}
      </div>
    </div>
  );
}

// ===== Bundles =====
function BundlesTab({ allowed }: { allowed: boolean }) {
  const [bundles, setBundles] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ name: "", product_ids: [], discount_percent: 10, is_active: true });

  async function load() {
    const [b, p] = await Promise.all([
      supabase.from("bundles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name_ar, price").eq("is_active", true).limit(200),
    ]);
    setBundles(b.data ?? []);
    setProducts(p.data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!form.name || form.product_ids.length < 2) return alert("اختر منتجين على الأقل");
    await supabase.from("bundles").insert(form);
    await logAudit({ action: "bundle.create", entity: "bundle", metadata: form });
    setForm({ name: "", product_ids: [], discount_percent: 10, is_active: true });
    setCreating(false); await load();
  }
  async function toggle(id: string, active: boolean) {
    await supabase.from("bundles").update({ is_active: !active }).eq("id", id); await load();
  }

  return (
    <div className="space-y-3">
      {allowed && (
        <button onClick={() => setCreating(!creating)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          {creating ? "إلغاء" : "+ حزمة جديدة"}
        </button>
      )}
      {creating && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2 text-xs">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الحزمة"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5" />
          <div>
            <p className="mb-1 font-medium">المنتجات في الحزمة:</p>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded border border-border p-2">
              {products.map((p) => {
                const has = form.product_ids.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 text-[11px]">
                    <input type="checkbox" checked={has} onChange={() => setForm({ ...form, product_ids: has ? form.product_ids.filter((x: string) => x !== p.id) : [...form.product_ids, p.id] })} />
                    {p.name_ar} <span className="ms-auto text-muted-foreground">{p.price}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: parseFloat(e.target.value) })}
            placeholder="نسبة الخصم %" className="w-full rounded-md border border-border bg-background px-3 py-1.5" />
          <button onClick={save} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">حفظ</button>
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {bundles.map((b) => (
          <div key={b.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold">{b.name}</h4>
                <p className="text-[11px] text-muted-foreground">{b.product_ids?.length ?? 0} منتجات • خصم {b.discount_percent}%</p>
              </div>
              {allowed && <button onClick={() => toggle(b.id, b.is_active)} className={`rounded px-2 py-0.5 text-[10px] ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted"}`}>{b.is_active ? "مفعّلة" : "معطّلة"}</button>}
            </div>
          </div>
        ))}
        {bundles.length === 0 && <p className="col-span-2 p-6 text-center text-xs text-muted-foreground">لا توجد حزم</p>}
      </div>
    </div>
  );
}

// ===== Loyalty =====
function LoyaltyTab({ allowed }: { allowed: boolean }) {
  const [s, setS] = useState<any>(null);
  useEffect(() => { void supabase.from("site_settings").select("loyalty_enabled, loyalty_points_per_currency, loyalty_redeem_rate, loyalty_signup_bonus, first_order_coupon_code, first_order_coupon_discount").eq("id", 1).maybeSingle().then(({ data }) => setS(data)); }, []);

  async function save() {
    if (!s) return;
    await supabase.from("site_settings").update(s).eq("id", 1);
    await logAudit({ action: "loyalty.settings_update", metadata: s });
    alert("تم الحفظ");
  }
  if (!s) return <p className="p-4 text-xs">جاري التحميل...</p>;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 max-w-xl">
      <h3 className="text-sm font-semibold">إعدادات برنامج الولاء</h3>
      <Toggle label="تفعيل برنامج الولاء" checked={s.loyalty_enabled} onChange={(v) => setS({ ...s, loyalty_enabled: v })} />
      <Field label="نقاط لكل ريال يُنفق"><Input type="number" value={s.loyalty_points_per_currency} onChange={(v) => setS({ ...s, loyalty_points_per_currency: parseFloat(v) })} /></Field>
      <Field label="قيمة الاستبدال (نقطة = ريال)"><Input type="number" value={s.loyalty_redeem_rate} onChange={(v) => setS({ ...s, loyalty_redeem_rate: parseFloat(v) })} /></Field>
      <Field label="مكافأة التسجيل (نقاط)"><Input type="number" value={s.loyalty_signup_bonus} onChange={(v) => setS({ ...s, loyalty_signup_bonus: parseInt(v) })} /></Field>
      <hr className="border-border" />
      <h3 className="text-sm font-semibold">كوبون أول طلب</h3>
      <Field label="كود الكوبون"><Input value={s.first_order_coupon_code ?? ""} onChange={(v) => setS({ ...s, first_order_coupon_code: v })} placeholder="WELCOME10" /></Field>
      <Field label="نسبة الخصم %"><Input type="number" value={s.first_order_coupon_discount} onChange={(v) => setS({ ...s, first_order_coupon_discount: parseFloat(v) })} /></Field>
      {allowed && <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground"><Save className="h-3 w-3" /> حفظ</button>}
    </div>
  );
}

// ===== Referrals =====
function ReferralsTab({ allowed }: { allowed: boolean }) {
  const [s, setS] = useState<any>(null);
  const [refs, setRefs] = useState<any[]>([]);
  useEffect(() => {
    void supabase.from("site_settings").select("referral_enabled, referral_referrer_reward, referral_referred_reward").eq("id", 1).maybeSingle().then(({ data }) => setS(data));
    void supabase.from("referrals").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setRefs(data ?? []));
  }, []);
  async function save() {
    await supabase.from("site_settings").update(s).eq("id", 1);
    await logAudit({ action: "referral.settings_update", metadata: s }); alert("تم");
  }
  if (!s) return <p className="p-4 text-xs">جاري التحميل...</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">إعدادات الإحالة</h3>
        <Toggle label="تفعيل برنامج الإحالة" checked={s.referral_enabled} onChange={(v) => setS({ ...s, referral_enabled: v })} />
        <Field label="مكافأة المُحيل (للعميل الذي دعا)"><Input type="number" value={s.referral_referrer_reward} onChange={(v) => setS({ ...s, referral_referrer_reward: parseFloat(v) })} /></Field>
        <Field label="مكافأة المُحال (الصديق الجديد)"><Input type="number" value={s.referral_referred_reward} onChange={(v) => setS({ ...s, referral_referred_reward: parseFloat(v) })} /></Field>
        {allowed && <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground">حفظ</button>}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">آخر الإحالات ({refs.length})</h3>
        <div className="space-y-1 text-xs max-h-80 overflow-y-auto">
          {refs.map((r) => (
            <div key={r.id} className="flex justify-between border-b border-border/40 pb-1">
              <span>{r.referred_email ?? "—"}</span>
              <span className={`rounded px-1.5 ${r.status === "rewarded" ? "bg-emerald-100 text-emerald-700" : "bg-muted"}`}>{r.status}</span>
            </div>
          ))}
          {refs.length === 0 && <p className="p-4 text-center text-muted-foreground">لا توجد إحالات</p>}
        </div>
      </div>
    </div>
  );
}

// ===== Landing Pages =====
function LandingTab({ allowed }: { allowed: boolean }) {
  const [pages, setPages] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ slug: "", title: "", subtitle: "", cta_text: "تسوّق الآن", utm_campaign: "", is_active: true });

  async function load() { const { data } = await supabase.from("landing_pages").select("*").order("created_at", { ascending: false }); setPages(data ?? []); }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!form.slug || !form.title) return alert("املأ الحقول");
    await supabase.from("landing_pages").insert(form);
    await logAudit({ action: "landing.create", entity: "landing", metadata: form });
    setForm({ slug: "", title: "", subtitle: "", cta_text: "تسوّق الآن", utm_campaign: "", is_active: true });
    setCreating(false); await load();
  }

  return (
    <div className="space-y-3">
      {allowed && <button onClick={() => setCreating(!creating)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">{creating ? "إلغاء" : "+ صفحة هبوط جديدة"}</button>}
      {creating && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
          <Field label="الرابط (slug)"><Input value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="summer-sale" /></Field>
          <Field label="العنوان"><Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></Field>
          <Field label="العنوان الفرعي"><Input value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} /></Field>
          <Field label="نص زر CTA"><Input value={form.cta_text} onChange={(v) => setForm({ ...form, cta_text: v })} /></Field>
          <Field label="UTM Campaign"><Input value={form.utm_campaign} onChange={(v) => setForm({ ...form, utm_campaign: v })} /></Field>
          <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground">إنشاء</button>
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {pages.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold">{p.title}</h4>
                <p className="text-[11px] text-muted-foreground">/landing/{p.slug} • {p.views} مشاهدة</p>
                {p.utm_campaign && <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">UTM: {p.utm_campaign}</span>}
              </div>
              <span className={`rounded px-2 py-0.5 text-[10px] ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted"}`}>{p.is_active ? "مفعّلة" : "معطّلة"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== A/B Tests =====
function ABTestsTab({ allowed }: { allowed: boolean }) {
  const [tests, setTests] = useState<any[]>([]);
  useEffect(() => { void supabase.from("ab_tests").select("*").order("created_at", { ascending: false }).then(({ data }) => setTests(data ?? [])); }, []);

  async function createSample() {
    await supabase.from("ab_tests").insert({
      name: "PDP CTA — Add to Cart vs Buy Now", scope: "pdp_cta",
      variant_a: { label: "أضف للسلة", color: "primary" },
      variant_b: { label: "اشترِ الآن", color: "emerald" },
    });
    await logAudit({ action: "ab_test.create" });
    const { data } = await supabase.from("ab_tests").select("*").order("created_at", { ascending: false });
    setTests(data ?? []);
  }

  return (
    <div className="space-y-3">
      {allowed && <button onClick={createSample} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">+ تجربة جديدة (مثال)</button>}
      <div className="space-y-2">
        {tests.map((t) => {
          const totalA = t.views_a || 1, totalB = t.views_b || 1;
          const cra = ((t.conversions_a / totalA) * 100).toFixed(1);
          const crb = ((t.conversions_b / totalB) * 100).toFixed(1);
          const winner = parseFloat(crb) > parseFloat(cra) ? "B" : parseFloat(cra) > parseFloat(crb) ? "A" : "—";
          return (
            <div key={t.id} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{t.name}</h4>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t.scope}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`rounded border p-2 ${winner === "A" ? "border-emerald-400 bg-emerald-50" : "border-border"}`}>
                  <p className="font-semibold">A {winner === "A" && "🏆"}</p>
                  <p className="text-muted-foreground">{t.views_a} مشاهدة • {t.conversions_a} تحويل</p>
                  <p className="font-mono">{cra}%</p>
                </div>
                <div className={`rounded border p-2 ${winner === "B" ? "border-emerald-400 bg-emerald-50" : "border-border"}`}>
                  <p className="font-semibold">B {winner === "B" && "🏆"}</p>
                  <p className="text-muted-foreground">{t.views_b} مشاهدة • {t.conversions_b} تحويل</p>
                  <p className="font-mono">{crb}%</p>
                </div>
              </div>
            </div>
          );
        })}
        {tests.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">لا توجد تجارب</p>}
      </div>
    </div>
  );
}

// ===== Search =====
function SearchTab({ allowed }: { allowed: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [synonyms, setSynonyms] = useState<any[]>([]);
  const [newTerm, setNewTerm] = useState(""); const [newSyn, setNewSyn] = useState("");

  async function load() {
    const [l, s] = await Promise.all([
      supabase.from("search_logs").select("query, results_count").order("created_at", { ascending: false }).limit(500),
      supabase.from("search_synonyms").select("*").order("created_at", { ascending: false }),
    ]);
    setLogs(l.data ?? []); setSynonyms(s.data ?? []);
  }
  useEffect(() => { void load(); }, []);

  // Aggregate
  const top = new Map<string, number>(), zero = new Map<string, number>();
  logs.forEach((l) => {
    if (l.results_count > 0) top.set(l.query, (top.get(l.query) ?? 0) + 1);
    else zero.set(l.query, (zero.get(l.query) ?? 0) + 1);
  });
  const topList = Array.from(top.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const zeroList = Array.from(zero.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);

  async function addSynonym() {
    if (!newTerm || !newSyn) return;
    await supabase.from("search_synonyms").insert({ term: newTerm, synonym: newSyn });
    setNewTerm(""); setNewSyn(""); await load();
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">🔥 أكثر عمليات البحث</h3>
        <div className="space-y-1 text-xs">
          {topList.map(([q, c]) => (
            <div key={q} className="flex justify-between border-b border-border/40 pb-1"><span>{q}</span><span className="text-muted-foreground">{c}</span></div>
          ))}
          {topList.length === 0 && <p className="text-center text-muted-foreground p-4">لا توجد بيانات</p>}
        </div>
      </div>

      <div className="rounded-xl border border-rose-300/30 bg-rose-50/30 p-3">
        <h3 className="mb-2 text-sm font-semibold text-rose-700">⚠️ بحث بدون نتائج</h3>
        <p className="mb-2 text-[10px] text-muted-foreground">أضف منتجات لهذه المصطلحات أو مرادفات</p>
        <div className="space-y-1 text-xs">
          {zeroList.map(([q, c]) => (
            <div key={q} className="flex justify-between border-b border-rose-200/40 pb-1"><span>{q}</span><span className="text-rose-600">{c}× فشل</span></div>
          ))}
          {zeroList.length === 0 && <p className="text-center text-muted-foreground p-4">ممتاز! كل البحث له نتائج</p>}
        </div>
      </div>

      {allowed && (
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">المرادفات (Search Synonyms)</h3>
          <p className="mb-2 text-[10px] text-muted-foreground">عند بحث مصطلح ما بدون نتائج، يُقترح المرادف</p>
          <div className="mb-2 flex gap-2">
            <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="المصطلح (مثلاً: تيشرت)"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
            <input value={newSyn} onChange={(e) => setNewSyn(e.target.value)} placeholder="المرادف (مثلاً: قميص)"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
            <button onClick={addSynonym} className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">إضافة</button>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {synonyms.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                <span><b>{s.term}</b> → {s.synonym}</span>
                <button onClick={async () => { await supabase.from("search_synonyms").delete().eq("id", s.id); load(); }} className="text-rose-600">حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Reusable inputs =====
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium">{label}</label>{children}</div>;
}
function Input(props: { value: any; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={props.type ?? "text"} placeholder={props.placeholder} value={props.value ?? ""}
    onChange={(e) => props.onChange(e.target.value)}
    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" />;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background p-2">
      <span className="text-xs font-medium">{label}</span>
      <span className="relative inline-flex">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="block h-5 w-9 rounded-full bg-muted peer-checked:bg-primary"></span>
        <span className="absolute end-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:-translate-x-4 rtl:peer-checked:translate-x-4"></span>
      </span>
    </label>
  );
}
