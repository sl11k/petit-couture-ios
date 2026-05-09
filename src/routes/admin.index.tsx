import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { DashboardCharts } from "@/features/admin/components/DashboardCharts";
import { AdminQuickSearch } from "@/features/admin/components/AdminQuickSearch";
import {
  ShoppingBag,
  Package,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

type Stats = {
  ordersTotal: number;
  ordersPending: number;
  ordersDelivered: number;
  ordersCancelled: number;
  revenueAll: number;
  revenue30d: number;
  productsTotal: number;
  productsActive: number;
  productsLowStock: number;
  productsOutOfStock: number;
  customersTotal: number;
  customersNew30d: number;
};

type RecentOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total: number;
  created_at: string;
};

type TopProduct = {
  id: string;
  name_ar: string;
  name_en: string;
  qty: number;
};

const fmtNum = (n: number, ar: boolean) => n.toLocaleString(ar ? "ar" : "en");
const fmtMoney = (n: number, ar: boolean) =>
  `${n.toLocaleString(ar ? "ar" : "en", { maximumFractionDigits: 2 })} ${ar ? "ر.س" : "SAR"}`;

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: typeof ShoppingBag;
  href?: string;
  tone?: "default" | "warn" | "danger" | "success";
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground";
  const inner = (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function Section({
  title,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {href && (
          <Link to={href} className="text-xs text-primary hover:underline">
            {hrefLabel}
          </Link>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function statusBadge(status: string, ar: boolean) {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    pending: { ar: "قيد الانتظار", en: "Pending", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    confirmed: { ar: "مؤكد", en: "Confirmed", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    processing: { ar: "قيد المعالجة", en: "Processing", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    shipped: { ar: "مشحون", en: "Shipped", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
    delivered: { ar: "مُسلَّم", en: "Delivered", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    cancelled: { ar: "ملغي", en: "Cancelled", cls: "bg-destructive/10 text-destructive" },
    refunded: { ar: "مُرتجع", en: "Refunded", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { ar: status, en: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {ar ? s.ar : s.en}
    </span>
  );
}

type StatusFilter = "all" | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
type PeriodFilter = "all" | "today" | "7d" | "30d" | "90d";

function periodSince(p: PeriodFilter): string | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (p) {
    case "today": {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
    }
    case "7d": return new Date(now - 7 * day).toISOString();
    case "30d": return new Date(now - 30 * day).toISOString();
    case "90d": return new Date(now - 90 * day).toISOString();
    default: return null;
  }
}

function Dashboard() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  useEffect(() => {
    (async () => {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        ordersAll,
        ordersPending,
        ordersDelivered,
        ordersCancelled,
        revenueAllRes,
        revenue30Res,
        productsTotal,
        productsActive,
        productsAll,
        customersTotal,
        customersNew,
        itemsRes,
      ] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("orders").select("total").neq("status", "cancelled"),
        supabase.from("orders").select("total").neq("status", "cancelled").gte("created_at", since30),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("products").select("stock,low_stock_threshold"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since30),
        supabase
          .from("order_items")
          .select("product_id,quantity,product_name_ar,product_name_en")
          .limit(1000),
      ]);

      const sum = (rows: any[] | null) =>
        (rows ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);

      const allProds = productsAll.data ?? [];
      const lowStock = allProds.filter(
        (p: any) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.low_stock_threshold ?? 5),
      ).length;
      const outStock = allProds.filter((p: any) => Number(p.stock) <= 0).length;

      const agg = new Map<string, TopProduct>();
      for (const it of itemsRes.data ?? []) {
        const key = (it as any).product_id ?? `${(it as any).product_name_en}`;
        const cur = agg.get(key) ?? {
          id: key,
          name_ar: (it as any).product_name_ar ?? "",
          name_en: (it as any).product_name_en ?? "",
          qty: 0,
        };
        cur.qty += Number((it as any).quantity ?? 0);
        agg.set(key, cur);
      }
      const topList = [...agg.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

      setStats({
        ordersTotal: ordersAll.count ?? 0,
        ordersPending: ordersPending.count ?? 0,
        ordersDelivered: ordersDelivered.count ?? 0,
        ordersCancelled: ordersCancelled.count ?? 0,
        revenueAll: sum(revenueAllRes.data),
        revenue30d: sum(revenue30Res.data),
        productsTotal: productsTotal.count ?? 0,
        productsActive: productsActive.count ?? 0,
        productsLowStock: lowStock,
        productsOutOfStock: outStock,
        customersTotal: customersTotal.count ?? 0,
        customersNew30d: customersNew.count ?? 0,
      });
      setTop(topList);
      setLoading(false);
    })();
  }, []);

  // Recent orders: refetch on filter change
  useEffect(() => {
    (async () => {
      setRecentLoading(true);
      let q = supabase
        .from("orders")
        .select("id,order_number,customer_name,status,total,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const since = periodSince(periodFilter);
      if (since) q = q.gte("created_at", since);
      const { data } = await q;
      setRecent((data as RecentOrder[]) ?? []);
      setRecentLoading(false);
    })();
  }, [statusFilter, periodFilter]);


  const v = (n?: number) =>
    loading || stats == null ? "…" : fmtNum(n ?? 0, ar);
  const m = (n?: number) =>
    loading || stats == null ? "…" : fmtMoney(n ?? 0, ar);

  return (
    <div className="space-y-6">
      <PageHeader
        title={{ ar: "لوحة التحكم", en: "Dashboard" }}
        description={{
          ar: "نظرة شاملة على الطلبات والمنتجات والعملاء",
          en: "Unified overview of orders, products and customers",
        }}
      />

      {/* Top KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={ar ? "إجمالي الطلبات" : "Total orders"}
          value={v(stats?.ordersTotal)}
          icon={ShoppingBag}
          href="/admin/orders"
        />
        <StatCard
          label={ar ? "إجمالي الإيرادات" : "Total revenue"}
          value={m(stats?.revenueAll)}
          icon={DollarSign}
          tone="success"
        />
        <StatCard
          label={ar ? "إيرادات آخر 30 يوم" : "Revenue (30d)"}
          value={m(stats?.revenue30d)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label={ar ? "العملاء" : "Customers"}
          value={v(stats?.customersTotal)}
          icon={Users}
          href="/admin/customers"
        />
      </div>

      {/* Interactive trend charts */}
      <DashboardCharts />

      {/* Orders breakdown */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          {ar ? "حالة الطلبات" : "Orders status"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={ar ? "قيد الانتظار" : "Pending"}
            value={v(stats?.ordersPending)}
            icon={Clock}
            tone="warn"
            href="/admin/orders"
          />
          <StatCard
            label={ar ? "مُسلَّم" : "Delivered"}
            value={v(stats?.ordersDelivered)}
            icon={CheckCircle2}
            tone="success"
            href="/admin/orders"
          />
          <StatCard
            label={ar ? "ملغي" : "Cancelled"}
            value={v(stats?.ordersCancelled)}
            icon={XCircle}
            tone="danger"
            href="/admin/orders"
          />
          <StatCard
            label={ar ? "عملاء جدد (30 يوم)" : "New customers (30d)"}
            value={v(stats?.customersNew30d)}
            icon={Users}
          />
        </div>
      </div>

      {/* Products breakdown */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          {ar ? "المنتجات والمخزون" : "Products & inventory"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={ar ? "إجمالي المنتجات" : "Total products"}
            value={v(stats?.productsTotal)}
            icon={Package}
            href="/admin/products"
          />
          <StatCard
            label={ar ? "منتجات نشطة" : "Active"}
            value={v(stats?.productsActive)}
            icon={CheckCircle2}
            tone="success"
            href="/admin/products"
          />
          <StatCard
            label={ar ? "مخزون منخفض" : "Low stock"}
            value={v(stats?.productsLowStock)}
            icon={AlertTriangle}
            tone="warn"
            href="/admin/inventory"
          />
          <StatCard
            label={ar ? "نفذ من المخزون" : "Out of stock"}
            value={v(stats?.productsOutOfStock)}
            icon={XCircle}
            tone="danger"
            href="/admin/inventory"
          />
        </div>
      </div>

      {/* Recent orders + top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title={ar ? "أحدث الطلبات" : "Recent orders"}
            href="/admin/orders"
            hrefLabel={ar ? "عرض الكل" : "View all"}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="all">{ar ? "كل الحالات" : "All statuses"}</option>
                <option value="pending">{ar ? "قيد الانتظار" : "Pending"}</option>
                <option value="confirmed">{ar ? "مؤكد" : "Confirmed"}</option>
                <option value="processing">{ar ? "قيد المعالجة" : "Processing"}</option>
                <option value="shipped">{ar ? "مشحون" : "Shipped"}</option>
                <option value="delivered">{ar ? "مُسلَّم" : "Delivered"}</option>
                <option value="cancelled">{ar ? "ملغي" : "Cancelled"}</option>
                <option value="refunded">{ar ? "مُرتجع" : "Refunded"}</option>
              </select>
              <div className="flex flex-wrap items-center gap-1">
                {([
                  ["all", ar ? "الكل" : "All"],
                  ["today", ar ? "اليوم" : "Today"],
                  ["7d", ar ? "7 أيام" : "7d"],
                  ["30d", ar ? "30 يوم" : "30d"],
                  ["90d", ar ? "90 يوم" : "90d"],
                ] as [PeriodFilter, string][]).map(([p, label]) => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className={`h-8 rounded-md border px-2 text-xs transition-colors ${
                      periodFilter === p
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(statusFilter !== "all" || periodFilter !== "all") && (
                <button
                  onClick={() => { setStatusFilter("all"); setPeriodFilter("all"); }}
                  className="ms-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  {ar ? "مسح" : "Clear"}
                </button>
              )}
            </div>
            <div className="divide-y divide-border">
              {recentLoading && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {ar ? "جاري التحميل…" : "Loading…"}
                </div>
              )}
              {!recentLoading && recent.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {ar ? "لا توجد طلبات مطابقة" : "No matching orders"}
                </div>
              )}
              {recent.map((o) => (
                <Link
                  key={o.id}
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{o.order_number}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.customer_name} · {new Date(o.created_at).toLocaleDateString(ar ? "ar" : "en")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(o.status, ar)}
                    <div className="text-sm font-semibold">{fmtMoney(Number(o.total), ar)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <Section
          title={ar ? "الأكثر مبيعًا" : "Top products"}
          href="/admin/products"
          hrefLabel={ar ? "عرض الكل" : "View all"}
        >
          <div className="divide-y divide-border">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {ar ? "جاري التحميل…" : "Loading…"}
              </div>
            )}
            {!loading && top.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {ar ? "لا توجد بيانات" : "No data"}
              </div>
            )}
            {top.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                    {fmtNum(i + 1, ar)}
                  </span>
                  <div className="truncate text-sm font-medium">
                    {ar ? p.name_ar || p.name_en : p.name_en || p.name_ar}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtNum(p.qty, ar)} {ar ? "قطعة" : "sold"}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
