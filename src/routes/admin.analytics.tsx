import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, DollarSign, Users, Package, TrendingUp, Activity, ShoppingCart, AlertTriangle, Clock, Target } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

type Range = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof ShoppingBag }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function AnalyticsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>("30d");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    grossPaid: 0,
    refundedAmount: 0,
    cancelledAmount: 0,
    unpaidAmount: 0,
    refundedOrdersCount: 0,
    cancelledOrdersCount: 0,
    unpaidOrdersCount: 0,
    revenueSources: [] as { source: string; amount: number; count: number }[],
    orders: 0,
    avgOrder: 0,
    customers: 0,
    sessions: 0,
    topProducts: [] as { name: string; qty: number }[],
    topStatuses: [] as { status: string; count: number }[],
    // Customer behaviour / drop-off
    checkoutsStarted: 0,
    checkoutsAbandoned: 0,
    checkoutsConverted: 0,
    conversionRate: 0,
    abandonedValue: 0,
    stageBreakdown: [] as { stage: string; count: number }[],
    topReasons: [] as { reason: string; count: number }[],
    recentDropoffs: [] as { id: string; email: string | null; phone: string | null; stage: string; subtotal: number; updated_at: string; reason: string | null }[],
    insights: [] as string[],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - RANGE_DAYS[range] * 86400000).toISOString();
      const [ordersRes, sessionsRes, itemsRes, customersRes, cartsRes] = await Promise.all([
        // Pull every order in range, then split paid / refunded / cancelled locally
        // so the revenue breakdown reconciles exactly with the orders table.
        supabase.from("orders").select("total, refunded_amount, status, payment_status, payment_method, created_at").gte("created_at", since),
        supabase.from("analytics_events").select("session_id").gte("created_at", since),
        supabase.from("order_items").select("product_name, qty, orders!inner(created_at, payment_status)").gte("orders.created_at", since).eq("orders.payment_status", "paid"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("abandoned_carts")
          .select("id, email, phone, stage, subtotal, updated_at, converted, reached_checkout, abandonment_reason")
          .gte("updated_at", since),
      ]);
      const allOrders = (ordersRes.data ?? []) as any[];
      const paidOrders = allOrders.filter((o: any) => String(o.payment_status) === "paid");
      const VOID_STATUSES = ["cancelled", "refunded", "returned", "payment_failed"];
      const orders = paidOrders.filter((o: any) => !VOID_STATUSES.includes(String(o.status)));

      // Revenue reconciliation buckets
      const grossPaid = paidOrders.reduce((s, o: any) => s + Number(o.total ?? 0), 0);
      const refundedAmount = paidOrders.reduce((s, o: any) => s + Number(o.refunded_amount ?? 0), 0);
      const cancelledAmount = paidOrders
        .filter((o: any) => VOID_STATUSES.includes(String(o.status)))
        .reduce((s, o: any) => s + Math.max(0, Number(o.total ?? 0) - Number(o.refunded_amount ?? 0)), 0);
      const unpaidAmount = allOrders
        .filter((o: any) => String(o.payment_status) !== "paid")
        .reduce((s, o: any) => s + Number(o.total ?? 0), 0);
      const refundedOrdersCount = paidOrders.filter((o: any) => Number(o.refunded_amount ?? 0) > 0).length;
      const cancelledOrdersCount = paidOrders.filter((o: any) => VOID_STATUSES.includes(String(o.status))).length;
      const unpaidOrdersCount = allOrders.length - paidOrders.length;

      const revenue = orders.reduce((s, o: any) => s + Math.max(0, Number(o.total ?? 0) - Number(o.refunded_amount ?? 0)), 0);

      // Paid-only revenue sources (payment methods)
      const sourceMap = new Map<string, { amount: number; count: number }>();
      orders.forEach((o: any) => {
        const k = String(o.payment_method ?? "unknown");
        const cur = sourceMap.get(k) ?? { amount: 0, count: 0 };
        cur.amount += Math.max(0, Number(o.total ?? 0) - Number(o.refunded_amount ?? 0));
        cur.count += 1;
        sourceMap.set(k, cur);
      });
      const revenueSources = Array.from(sourceMap.entries())
        .map(([source, v]) => ({ source, ...v }))
        .sort((a, b) => b.amount - a.amount);

      const avgOrder = orders.length > 0 ? revenue / orders.length : 0;
      const sessions = new Set((sessionsRes.data ?? []).map((s: any) => s.session_id).filter(Boolean)).size;

      // Top products
      const productMap = new Map<string, number>();
      (itemsRes.data ?? []).forEach((it: any) => {
        const name = it.product_name ?? "—";
        productMap.set(name, (productMap.get(name) ?? 0) + Number(it.qty ?? 1));
      });
      const topProducts = Array.from(productMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }));

      // Status breakdown
      const statusMap = new Map<string, number>();
      orders.forEach((o: any) => statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1));
      const topStatuses = Array.from(statusMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count }));

      // ============ Customer behaviour / drop-off ============
      const carts = cartsRes.data ?? [];
      const checkoutsStarted = carts.length;
      const checkoutsConverted = carts.filter((c: any) => c.converted).length;
      const checkoutsAbandoned = checkoutsStarted - checkoutsConverted;
      const conversionRate = checkoutsStarted > 0 ? (checkoutsConverted / checkoutsStarted) * 100 : 0;
      const abandonedValue = carts
        .filter((c: any) => !c.converted)
        .reduce((s: number, c: any) => s + Number(c.subtotal ?? 0), 0);

      const stageMap = new Map<string, number>();
      carts.filter((c: any) => !c.converted).forEach((c: any) => {
        const k = c.stage || (c.reached_checkout ? "checkout" : "cart");
        stageMap.set(k, (stageMap.get(k) ?? 0) + 1);
      });
      const stageBreakdown = Array.from(stageMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([stage, count]) => ({ stage, count }));

      const reasonMap = new Map<string, number>();
      carts.filter((c: any) => !c.converted && c.abandonment_reason).forEach((c: any) => {
        reasonMap.set(c.abandonment_reason, (reasonMap.get(c.abandonment_reason) ?? 0) + 1);
      });
      const topReasons = Array.from(reasonMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      const recentDropoffs = carts
        .filter((c: any) => !c.converted)
        .sort((a: any, b: any) => (a.updated_at < b.updated_at ? 1 : -1))
        .slice(0, 10)
        .map((c: any) => ({
          id: c.id,
          email: c.email,
          phone: c.phone,
          stage: c.stage || (c.reached_checkout ? "checkout" : "cart"),
          subtotal: Number(c.subtotal ?? 0),
          updated_at: c.updated_at,
          reason: c.abandonment_reason,
        }));

      // Smart insights
      const insights: string[] = [];
      if (conversionRate > 0 && conversionRate < 20) {
        insights.push(ar
          ? `معدل التحويل منخفض (${conversionRate.toFixed(1)}%). راجع سرعة الدفع وطرق الدفع المتاحة.`
          : `Low conversion rate (${conversionRate.toFixed(1)}%). Review checkout speed and payment options.`);
      }
      const paymentDrops = stageMap.get("payment") ?? 0;
      if (paymentDrops > 0 && paymentDrops >= checkoutsAbandoned * 0.4) {
        insights.push(ar
          ? `${paymentDrops} عميل توقف في مرحلة الدفع — قد تكون هناك مشكلة في بوابة الدفع.`
          : `${paymentDrops} customers dropped at payment — possible payment gateway issue.`);
      }
      const checkoutDrops = stageMap.get("checkout") ?? 0;
      if (checkoutDrops > 0 && checkoutDrops >= checkoutsAbandoned * 0.4) {
        insights.push(ar
          ? `${checkoutDrops} عميل تخلى عن الطلب في نموذج الدفع — بسّط الحقول أو أضف تسجيل دخول سريع.`
          : `${checkoutDrops} customers left at checkout form — simplify fields or add express login.`);
      }
      if (abandonedValue > revenue * 0.3 && revenue > 0) {
        insights.push(ar
          ? `قيمة السلال المتروكة (${abandonedValue.toFixed(0)}) كبيرة مقارنة بالإيرادات — فعّل حملة استرداد.`
          : `Abandoned value (${abandonedValue.toFixed(0)}) is high vs revenue — enable a recovery campaign.`);
      }
      if (insights.length === 0 && checkoutsStarted > 0) {
        insights.push(ar
          ? `أداء صحي: معدل التحويل ${conversionRate.toFixed(1)}%.`
          : `Healthy performance: ${conversionRate.toFixed(1)}% conversion rate.`);
      }

      setStats({
        revenue,
        grossPaid,
        refundedAmount,
        cancelledAmount,
        unpaidAmount,
        refundedOrdersCount,
        cancelledOrdersCount,
        unpaidOrdersCount,
        revenueSources,
        orders: orders.length,
        avgOrder,
        customers: customersRes.count ?? 0,
        sessions,
        topProducts,
        topStatuses,
        checkoutsStarted,
        checkoutsAbandoned,
        checkoutsConverted,
        conversionRate,
        abandonedValue,
        stageBreakdown,
        topReasons,
        recentDropoffs,
        insights,
      });
      setLoading(false);
    })();
  }, [range, ar]);

  const fmt = (n: number) => n.toLocaleString(ar ? "ar" : "en", { maximumFractionDigits: 0 });

  return (
    <div>
      <PageHeader
        title={{ ar: "التحليلات", en: "Analytics" }}
        description={{ ar: `آخر ${RANGE_DAYS[range]} يوم`, en: `Last ${RANGE_DAYS[range]} days` }}
        actions={
          <div className="flex gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded px-2.5 py-1 ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label={ar ? "الإيرادات" : "Revenue"} value={`${fmt(stats.revenue)} ${ar ? "ر.س" : "SAR"}`} icon={DollarSign} />
        <StatCard label={ar ? "الطلبات" : "Orders"} value={loading ? "…" : fmt(stats.orders)} icon={ShoppingBag} />
        <StatCard label={ar ? "متوسط الطلب" : "Avg order"} value={`${fmt(stats.avgOrder)} ${ar ? "ر.س" : "SAR"}`} icon={TrendingUp} />
        <StatCard label={ar ? "عملاء جدد" : "New customers"} value={loading ? "…" : fmt(stats.customers)} icon={Users} />
        <StatCard label={ar ? "الجلسات" : "Sessions"} value={loading ? "…" : fmt(stats.sessions)} icon={Activity} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" /> {ar ? "أكثر المنتجات مبيعاً" : "Top products"}
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</p>
          ) : (
            <ul className="space-y-2">
              {stats.topProducts.map((p, i) => {
                const max = stats.topProducts[0].qty || 1;
                const pct = (p.qty / max) * 100;
                return (
                  <li key={i}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate">{p.name}</span>
                      <span className="font-medium">{fmt(p.qty)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{ar ? "حالات الطلبات" : "Order statuses"}</h2>
          {stats.topStatuses.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</p>
          ) : (
            <ul className="space-y-2">
              {stats.topStatuses.map((s, i) => {
                const total = stats.topStatuses.reduce((sum, x) => sum + x.count, 0) || 1;
                const pct = (s.count / total) * 100;
                return (
                  <li key={i}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>{s.status}</span>
                      <span className="font-medium">{fmt(s.count)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ========== Customer behaviour / drop-off ========== */}
      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-muted-foreground" />
          {ar ? "سلوك العملاء وتحليل التخلي" : "Customer behaviour & drop-off"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={ar ? "بدأوا الدفع" : "Checkouts started"} value={loading ? "…" : fmt(stats.checkoutsStarted)} icon={ShoppingCart} />
          <StatCard label={ar ? "تخلوا عن الطلب" : "Abandoned"} value={loading ? "…" : fmt(stats.checkoutsAbandoned)} icon={AlertTriangle} />
          <StatCard label={ar ? "أكملوا الطلب" : "Completed"} value={loading ? "…" : fmt(stats.checkoutsConverted)} icon={ShoppingBag} />
          <StatCard label={ar ? "معدل التحويل" : "Conversion rate"} value={`${stats.conversionRate.toFixed(1)}%`} icon={TrendingUp} />
        </div>

        {stats.insights.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {ar ? "رؤى ذكية" : "Smart insights"}
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {stats.insights.map((tip, i) => (
                <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{tip}</span></li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{ar ? "نقاط التوقف" : "Where they dropped off"}</h3>
            {stats.stageBreakdown.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</p>
            ) : (
              <ul className="space-y-2">
                {stats.stageBreakdown.map((s, i) => {
                  const total = stats.stageBreakdown.reduce((sum, x) => sum + x.count, 0) || 1;
                  const pct = (s.count / total) * 100;
                  const stageLabel = ar
                    ? ({ cart: "السلة", checkout: "نموذج الدفع", payment: "بوابة الدفع" } as any)[s.stage] || s.stage
                    : ({ cart: "Cart", checkout: "Checkout form", payment: "Payment gateway" } as any)[s.stage] || s.stage;
                  return (
                    <li key={i}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>{stageLabel}</span>
                        <span className="font-medium">{fmt(s.count)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-destructive/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {ar ? "القيمة المتروكة: " : "Abandoned value: "}
              <span className="font-medium text-foreground">{fmt(stats.abandonedValue)} {ar ? "ر.س" : "SAR"}</span>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{ar ? "أسباب التخلي" : "Abandonment reasons"}</h3>
            {stats.topReasons.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">{ar ? "لا توجد أسباب مسجلة" : "No reasons recorded"}</p>
            ) : (
              <ul className="space-y-2">
                {stats.topReasons.map((r, i) => {
                  const max = stats.topReasons[0].count || 1;
                  const pct = (r.count / max) * 100;
                  return (
                    <li key={i}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate">{r.reason}</span>
                        <span className="font-medium">{fmt(r.count)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-amber-500/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {ar ? "آخر العملاء الذين توقفوا" : "Recent drop-offs"}
            </h3>
            <Link to="/admin/abandoned" className="text-xs text-primary hover:underline">
              {ar ? "عرض الكل →" : "View all →"}
            </Link>
          </div>
          {stats.recentDropoffs.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-start font-medium">{ar ? "العميل" : "Customer"}</th>
                    <th className="py-2 text-start font-medium">{ar ? "المرحلة" : "Stage"}</th>
                    <th className="py-2 text-start font-medium">{ar ? "القيمة" : "Value"}</th>
                    <th className="py-2 text-start font-medium">{ar ? "السبب" : "Reason"}</th>
                    <th className="py-2 text-start font-medium">{ar ? "متى" : "When"}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDropoffs.map((d) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2">{d.email || d.phone || "—"}</td>
                      <td className="py-2">{d.stage}</td>
                      <td className="py-2">{fmt(d.subtotal)}</td>
                      <td className="py-2 text-muted-foreground">{d.reason || "—"}</td>
                      <td className="py-2 text-muted-foreground">{new Date(d.updated_at).toLocaleString(ar ? "ar" : "en", { dateStyle: "short", timeStyle: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
