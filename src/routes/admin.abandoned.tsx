import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Search, Download, MessageCircle, Mail, Phone, Link2, Copy, Check,
  TrendingUp, ShoppingCart, AlertCircle, Sparkles, X, Send,
} from "lucide-react";

export const Route = createFileRoute("/admin/abandoned")({
  component: AbandonedCartsPage,
});

type Cart = {
  id: string;
  session_id: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  subtotal: number;
  currency: string;
  items: any[];
  reached_checkout: boolean;
  converted: boolean;
  stage: string;
  source: string;
  recovery_token: string;
  recovered_order_id: string | null;
  recovery_coupon_code: string | null;
  abandonment_reason: string | null;
  contact_status: string;
  contact_attempts: number;
  last_contacted_at: string | null;
  first_seen_at: string;
  created_at: string;
  updated_at: string;
};

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "cart", label: "أضاف للسلة", color: "bg-gray-100 text-gray-700" },
  { key: "checkout", label: "دخل Checkout", color: "bg-blue-100 text-blue-700" },
  { key: "info", label: "أدخل بياناته", color: "bg-indigo-100 text-indigo-700" },
  { key: "shipping", label: "اختار الشحن", color: "bg-purple-100 text-purple-700" },
  { key: "payment", label: "اختار الدفع", color: "bg-yellow-100 text-yellow-800" },
  { key: "payment_failed", label: "فشل الدفع", color: "bg-red-100 text-red-700" },
  { key: "payment_abandoned", label: "ترك صفحة الدفع", color: "bg-orange-100 text-orange-700" },
];

const REASONS = [
  "سعر الشحن مرتفع",
  "طريقة الدفع غير متوفرة",
  "مشكلة تقنية",
  "يقارن أسعار",
  "نسي السلة",
  "وجد المنتج أرخص في مكان آخر",
  "مشكلة في الكوبون",
  "أخرى",
];

function AbandonedCartsPage() {
  const { isAdmin, isManager, canManage } = useUserRole();
  const canExport = isAdmin || isManager;

  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"abandoned" | "recovered" | "all">("abandoned");
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"list" | "reports">("list");
  const [drawer, setDrawer] = useState<Cart | null>(null);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase
      .from("abandoned_carts")
      .select("*")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(500);
    setCarts((data ?? []) as Cart[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [days]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return carts.filter((c) => {
      if (statusFilter === "abandoned" && c.converted) return false;
      if (statusFilter === "recovered" && !c.converted) return false;
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (!q) return true;
      return (c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) || c.session_id.includes(q));
    });
  }, [carts, search, stageFilter, statusFilter]);

  // ============ KPIs ============
  const kpis = useMemo(() => {
    const abandoned = carts.filter((c) => !c.converted);
    const recovered = carts.filter((c) => c.converted);
    const totalValue = abandoned.reduce((s, c) => s + Number(c.subtotal), 0);
    const recoveredValue = recovered.reduce((s, c) => s + Number(c.subtotal), 0);
    const recoveryRate = carts.length ? (recovered.length / carts.length) * 100 : 0;
    return {
      total: carts.length, abandoned: abandoned.length, recovered: recovered.length,
      totalValue, recoveredValue, recoveryRate,
    };
  }, [carts]);

  // ============ Reports ============
  const stageBreakdown = useMemo(() => {
    return STAGES.map((s) => ({
      ...s,
      count: carts.filter((c) => !c.converted && c.stage === s.key).length,
    }));
  }, [carts]);

  const topAbandonedProducts = useMemo(() => {
    const map = new Map<string, { name: string; count: number; value: number }>();
    carts.filter((c) => !c.converted).forEach((c) => {
      (c.items ?? []).forEach((it: any) => {
        const key = it.id || it.name_ar || it.name;
        if (!key) return;
        const cur = map.get(key) ?? { name: it.name_ar || it.name || key, count: 0, value: 0 };
        cur.count += Number(it.quantity ?? 1);
        cur.value += Number(it.price ?? 0) * Number(it.quantity ?? 1);
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [carts]);

  const reasonBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    carts.filter((c) => !c.converted && c.abandonment_reason).forEach((c) => {
      map.set(c.abandonment_reason!, (map.get(c.abandonment_reason!) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [carts]);

  function exportCSV() {
    if (!canExport) return alert("التصدير للإدمن/المدير فقط");
    const rows = [
      ["الجلسة", "الإيميل", "الجوال", "المرحلة", "المصدر", "القيمة", "حالة التواصل", "محاولات", "آخر تواصل", "آخر نشاط", "مُستعادة"],
      ...filtered.map((c) => [
        c.session_id, c.email ?? "", c.phone ?? "",
        STAGES.find((s) => s.key === c.stage)?.label ?? c.stage,
        c.source, c.subtotal.toFixed(2), c.contact_status, String(c.contact_attempts),
        c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleString("ar") : "",
        new Date(c.updated_at).toLocaleString("ar"),
        c.converted ? "نعم" : "لا",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `abandoned-carts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">السلات المتروكة</h1>
          <p className="text-xs text-muted-foreground">تتبع، تواصل، واستعد العملاء قبل أن يفقدوا الاهتمام</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
            <option value={7}>آخر 7 أيام</option>
            <option value={14}>آخر 14 يوم</option>
            <option value={30}>آخر 30 يوم</option>
            <option value={90}>آخر 90 يوم</option>
          </select>
          <button onClick={exportCSV} disabled={!canExport}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> تصدير
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="إجمالي السلات" value={String(kpis.total)} icon={<ShoppingCart className="h-4 w-4" />} />
        <Kpi label="متروكة" value={String(kpis.abandoned)} icon={<AlertCircle className="h-4 w-4 text-orange-500" />} />
        <Kpi label="مُستعادة" value={String(kpis.recovered)} icon={<Check className="h-4 w-4 text-green-600" />} />
        <Kpi label="معدل الاستعادة" value={`${kpis.recoveryRate.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
        <Kpi label="قيمة المتروكة" value={`${kpis.totalValue.toFixed(0)}`} icon={<X className="h-4 w-4 text-red-500" />} />
        <Kpi label="قيمة المستعادة" value={`${kpis.recoveredValue.toFixed(0)}`} icon={<Sparkles className="h-4 w-4 text-green-600" />} />
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-md bg-card p-1 text-xs w-fit">
        {([["list", "القائمة"], ["reports", "تقارير"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`rounded px-3 py-1.5 ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث: إيميل / جوال / جلسة..."
                className="w-full rounded-md border border-border bg-background py-2 pr-10 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="abandoned">متروكة فقط</option>
              <option value="recovered">مُستعادة فقط</option>
              <option value="all">الكل</option>
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="all">كل المراحل</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">العميل</th>
                    <th className="p-3">المنتجات</th>
                    <th className="p-3 text-center">القيمة</th>
                    <th className="p-3">المرحلة</th>
                    <th className="p-3">المصدر</th>
                    <th className="p-3">آخر نشاط</th>
                    <th className="p-3">التواصل</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const stage = STAGES.find((s) => s.key === c.stage);
                    return (
                      <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                        <td className="p-3">
                          <div className="text-sm font-medium">{c.email || c.phone || "زائر مجهول"}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{c.session_id.slice(0, 12)}...</div>
                          {c.converted && <span className="inline-block mt-0.5 rounded-full bg-green-100 px-1.5 text-[10px] text-green-800">✓ مستعادة</span>}
                        </td>
                        <td className="p-3 text-xs">{(c.items ?? []).length} منتج</td>
                        <td className="p-3 text-center font-semibold">{Number(c.subtotal).toFixed(0)}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${stage?.color ?? "bg-gray-100"}`}>
                            {stage?.label ?? c.stage}
                          </span>
                        </td>
                        <td className="p-3 text-[11px]">{c.source}</td>
                        <td className="p-3 text-[11px] text-muted-foreground">
                          {new Date(c.updated_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="p-3 text-[11px]">
                          {c.contact_status === "not_contacted" ? <span className="text-muted-foreground">لم يتم</span> :
                            <span>{c.contact_status} ({c.contact_attempts})</span>}
                        </td>
                        <td className="p-3">
                          <button onClick={() => setDrawer(c)}
                            className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted">
                            تفاصيل
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-xs text-muted-foreground">لا توجد سلات مطابقة</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "reports" && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Stage funnel */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">أكثر مرحلة يترك فيها العملاء</h3>
            <div className="space-y-2">
              {stageBreakdown.map((s) => {
                const max = Math.max(...stageBreakdown.map((x) => x.count), 1);
                const pct = (s.count / max) * 100;
                return (
                  <div key={s.key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{s.label}</span><span className="font-semibold">{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top abandoned products */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">أكثر المنتجات تركاً في السلة</h3>
            {topAbandonedProducts.length === 0 ? <p className="text-center text-xs text-muted-foreground">لا بيانات</p> : (
              <ul className="space-y-2 text-sm">
                {topAbandonedProducts.map((p, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-border/50 pb-1 last:border-0">
                    <span className="truncate">{p.name}</span>
                    <span className="ml-2 shrink-0 text-xs">
                      <span className="font-semibold">{p.count}×</span>{" "}
                      <span className="text-muted-foreground">({p.value.toFixed(0)} ر.س)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Abandonment reasons */}
          <div className="rounded-xl border border-border bg-card p-4 md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">الأسباب المحتملة للترك (المسجَّلة)</h3>
            {reasonBreakdown.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                لم يُسجَّل أي سبب بعد. يمكن إضافة سبب لكل سلة من نافذة التفاصيل.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {reasonBreakdown.map((r) => (
                  <div key={r.reason} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                    <span>{r.reason}</span>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {drawer && <CartDrawer cart={drawer} onClose={() => setDrawer(null)} onChanged={load} canManage={canManage} />}
    </AdminShell>
  );
}

// ============= Cart drawer =============

function CartDrawer({ cart, onClose, onChanged, canManage }: {
  cart: Cart; onClose: () => void; onChanged: () => void; canManage: boolean;
}) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [reason, setReason] = useState(cart.abandonment_reason ?? "");
  const [generating, setGenerating] = useState(false);
  const [coupon, setCoupon] = useState(cart.recovery_coupon_code ?? "");
  const [copied, setCopied] = useState(false);

  const recoveryUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/cart?recover=${cart.recovery_token}`;

  async function loadAttempts() {
    const { data } = await supabase
      .from("cart_recovery_attempts")
      .select("*").eq("cart_id", cart.id).order("created_at", { ascending: false });
    setAttempts(data ?? []);
  }
  useEffect(() => { void loadAttempts(); }, [cart.id]);

  async function logAttempt(channel: string, message?: string, code?: string) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("cart_recovery_attempts").insert({
      cart_id: cart.id, channel, status: "sent", message, coupon_code: code,
      actor_id: u.user?.id, actor_email: u.user?.email,
    });
    await supabase.from("abandoned_carts").update({
      contact_status: channel,
      contact_attempts: cart.contact_attempts + 1,
      last_contacted_at: new Date().toISOString(),
    }).eq("id", cart.id);
    await loadAttempts();
    onChanged();
  }

  async function generateCoupon() {
    if (!canManage) return alert("الكوبونات للإدمن/المدير فقط");
    setGenerating(true);
    const code = `RECOVER-${cart.session_id.slice(0, 6).toUpperCase()}`;
    await supabase.from("coupons").upsert({
      code, discount_type: "percent", discount_value: 10,
      description: `استعادة سلة ${cart.session_id}`,
      max_uses: 1, is_active: true,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }, { onConflict: "code" });
    await supabase.from("abandoned_carts").update({ recovery_coupon_code: code }).eq("id", cart.id);
    setCoupon(code);
    setGenerating(false);
    onChanged();
  }

  async function saveReason() {
    await supabase.from("abandoned_carts").update({ abandonment_reason: reason || null }).eq("id", cart.id);
    onChanged();
  }

  function copyLink() {
    navigator.clipboard.writeText(recoveryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const messageBody = `مرحباً! لاحظنا أنك تركت سلة بقيمة ${cart.subtotal} ر.س. أكمل طلبك بسهولة من هنا: ${recoveryUrl}${coupon ? `\n\nاستخدم كود ${coupon} للحصول على خصم 10%` : ""}`;
  const phoneDigits = cart.phone?.replace(/\D/g, "") ?? "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
          <h2 className="text-sm font-semibold">تفاصيل السلة المتروكة</h2>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-2 text-sm">
            <Info label="العميل">{cart.email || cart.phone || "زائر مجهول"}</Info>
            <Info label="القيمة">{Number(cart.subtotal).toFixed(2)} {cart.currency}</Info>
            <Info label="المرحلة">{STAGES.find((s) => s.key === cart.stage)?.label ?? cart.stage}</Info>
            <Info label="المصدر">{cart.source}</Info>
            <Info label="أول مشاهدة">{new Date(cart.first_seen_at ?? cart.created_at).toLocaleString("ar")}</Info>
            <Info label="آخر نشاط">{new Date(cart.updated_at).toLocaleString("ar")}</Info>
          </div>

          {/* Items */}
          <div>
            <h3 className="mb-2 text-xs font-semibold">المنتجات ({(cart.items ?? []).length})</h3>
            <div className="space-y-1.5">
              {(cart.items ?? []).map((it: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border bg-background p-2 text-xs">
                  <span>{it.name_ar || it.name || it.id} × {it.quantity ?? 1}</span>
                  <span className="font-semibold">{Number(it.price ?? 0).toFixed(0)} ر.س</span>
                </div>
              ))}
              {(cart.items ?? []).length === 0 && <p className="text-center text-xs text-muted-foreground">لا منتجات</p>}
            </div>
          </div>

          {/* Recovery link + coupon */}
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <h3 className="text-xs font-semibold">رابط الاستعادة</h3>
            <div className="flex items-center gap-1">
              <input readOnly value={recoveryUrl}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-mono" />
              <button onClick={copyLink} className="rounded-md bg-primary p-1.5 text-primary-foreground">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {coupon ? (
              <div className="flex items-center gap-2 rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-800">
                <Sparkles className="h-3.5 w-3.5" /> كود الخصم: <span className="font-mono font-bold">{coupon}</span>
              </div>
            ) : (
              <button onClick={generateCoupon} disabled={generating || !canManage}
                className="flex w-full items-center justify-center gap-1 rounded-md border border-primary bg-background px-3 py-1.5 text-xs text-primary disabled:opacity-50">
                <Sparkles className="h-3.5 w-3.5" /> {generating ? "جاري..." : "توليد كوبون استعادة 10%"}
              </button>
            )}
          </div>

          {/* Communication actions */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">إجراءات الاستعادة</h3>
            <div className="grid grid-cols-3 gap-2">
              {phoneDigits && (
                <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageBody)}`}
                  target="_blank" rel="noreferrer"
                  onClick={() => logAttempt("whatsapp", messageBody, coupon || undefined)}
                  className="flex items-center justify-center gap-1 rounded-md bg-green-600 px-2 py-2 text-xs text-white">
                  <MessageCircle className="h-3.5 w-3.5" /> واتساب
                </a>
              )}
              {cart.email && (
                <a href={`mailto:${cart.email}?subject=${encodeURIComponent("أكمل طلبك")}&body=${encodeURIComponent(messageBody)}`}
                  onClick={() => logAttempt("email", messageBody, coupon || undefined)}
                  className="flex items-center justify-center gap-1 rounded-md bg-blue-600 px-2 py-2 text-xs text-white">
                  <Mail className="h-3.5 w-3.5" /> إيميل
                </a>
              )}
              {cart.phone && (
                <button onClick={() => logAttempt("sms", messageBody, coupon || undefined)}
                  className="flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-2 text-xs">
                  <Send className="h-3.5 w-3.5" /> تسجيل SMS
                </button>
              )}
              {cart.phone && (
                <a href={`tel:${cart.phone}`}
                  onClick={() => logAttempt("call")}
                  className="flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-2 text-xs">
                  <Phone className="h-3.5 w-3.5" /> اتصال
                </a>
              )}
              <button onClick={() => { copyLink(); logAttempt("link_shared"); }}
                className="flex items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-2 text-xs">
                <Link2 className="h-3.5 w-3.5" /> نسخ الرابط
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <h3 className="mb-1 text-xs font-semibold">سبب الترك (لتحليل التقارير)</h3>
            <div className="flex gap-1">
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                <option value="">— غير محدد —</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={saveReason} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">حفظ</button>
            </div>
          </div>

          {/* History */}
          <div>
            <h3 className="mb-2 text-xs font-semibold">سجل محاولات الاستعادة</h3>
            {attempts.length === 0 ? <p className="text-center text-xs text-muted-foreground">لا محاولات</p> : (
              <div className="space-y-1.5">
                {attempts.map((a) => (
                  <div key={a.id} className="rounded-md border border-border bg-background p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">{a.channel}</span>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("ar")}</span>
                    </div>
                    {a.coupon_code && <div className="text-[10px] text-green-700">كوبون: {a.coupon_code}</div>}
                    {a.actor_email && <div className="text-[10px] text-muted-foreground">— {a.actor_email}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= Mini components =============

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right">{children}</span>
    </div>
  );
}
