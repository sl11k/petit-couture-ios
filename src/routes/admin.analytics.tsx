import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ShoppingBag, DollarSign, Users, Package, TrendingUp, Activity } from "lucide-react";

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
    orders: 0,
    avgOrder: 0,
    customers: 0,
    sessions: 0,
    topProducts: [] as { name: string; qty: number }[],
    topStatuses: [] as { status: string; count: number }[],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - RANGE_DAYS[range] * 86400000).toISOString();
      const [ordersRes, sessionsRes, itemsRes, customersRes] = await Promise.all([
        supabase.from("orders").select("total, status, created_at").gte("created_at", since),
        supabase.from("analytics_events").select("session_id").gte("created_at", since),
        supabase.from("order_items").select("product_name, qty, orders!inner(created_at)").gte("orders.created_at", since),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
      ]);
      const orders = ordersRes.data ?? [];
      const revenue = orders.reduce((s, o: any) => s + Number(o.total ?? 0), 0);
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

      setStats({
        revenue,
        orders: orders.length,
        avgOrder,
        customers: customersRes.count ?? 0,
        sessions,
        topProducts,
        topStatuses,
      });
      setLoading(false);
    })();
  }, [range]);

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
    </div>
  );
}
