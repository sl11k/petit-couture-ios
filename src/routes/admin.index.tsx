import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useTr } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  ShoppingCart,
  Package,
  AlertTriangle,
  Eye,
  Percent,
  Wallet,
  MapPin,
  Truck,
  Calendar,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

type Stats = {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  ordersCount: number;
  ordersPending: number;
  ordersAwaitingShip: number;
  ordersOverdue: number;
  aov: number;
  newCustomers: number;
  visits: number;
  conversion: number;
  abandonedCarts: number;
  lowStockCount: number;
};

type TopProduct = { name: string; qty: number; revenue: number };
type TopCity = { city: string; count: number };
type PaymentDist = { method: string; count: number };

function AdminHome() {
  const tr = useTr();
  const { lang } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCities, setTopCities] = useState<TopCity[]>([]);
  const [payments, setPayments] = useState<PaymentDist[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(now - 7 * 86400000);
    const startMonth = new Date(now - 30 * 86400000);
    const overdueDate = new Date(now - 3 * 86400000);

    const [
      ordersToday, ordersWeek, ordersMonth,
      ordersAll, ordersPending, ordersAwaiting, ordersOverdue,
      newCustomers, visits, carts, lowStockRes,
      recentRes, topItemsRes, ordersForCities, ordersForPayments,
    ] = await Promise.all([
      supabase.from("orders").select("total").gte("created_at", startToday.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("total").gte("created_at", startWeek.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("total").gte("created_at", startMonth.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startMonth.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "pending").lt("created_at", overdueDate.toISOString()),
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", startMonth.toISOString()),
      supabase.from("analytics_events").select("session_id")
        .eq("event_name", "page_view").gte("created_at", startMonth.toISOString()),
      supabase.from("abandoned_carts").select("id", { count: "exact", head: true })
        .eq("converted", false).gte("updated_at", startWeek.toISOString()),
      supabase.from("products").select("id, name_ar, name_en, stock, image_url")
        .lte("stock", 5).eq("is_active", true).order("stock", { ascending: true }).limit(8),
      supabase.from("orders")
        .select("id, order_number, customer_name, total, currency, status, created_at")
        .order("created_at", { ascending: false }).limit(8),
      supabase.from("order_items")
        .select("product_name, qty, line_total, created_at")
        .gte("created_at", startMonth.toISOString()),
      supabase.from("orders").select("shipping_address").gte("created_at", startMonth.toISOString()),
      supabase.from("orders").select("payment_method").gte("created_at", startMonth.toISOString()),
    ]);

    const sumTotal = (arr: any[] | null) => (arr ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
    const salesToday = sumTotal(ordersToday.data);
    const salesWeek = sumTotal(ordersWeek.data);
    const salesMonth = sumTotal(ordersMonth.data);
    const ordersCount = ordersAll.count ?? 0;
    const aov = ordersCount > 0 ? salesMonth / ordersCount : 0;

    const uniqueSessions = new Set((visits.data ?? []).map((v: any) => v.session_id).filter(Boolean));
    const visitCount = uniqueSessions.size;
    const conversion = visitCount > 0 ? (ordersCount / visitCount) * 100 : 0;

    setStats({
      salesToday, salesWeek, salesMonth,
      ordersCount,
      ordersPending: ordersPending.count ?? 0,
      ordersAwaitingShip: ordersAwaiting.count ?? 0,
      ordersOverdue: ordersOverdue.count ?? 0,
      aov,
      newCustomers: newCustomers.count ?? 0,
      visits: visitCount,
      conversion,
      abandonedCarts: carts.count ?? 0,
      lowStockCount: (lowStockRes.data ?? []).length,
    });
    setLowStock(lowStockRes.data ?? []);
    setRecentOrders(recentRes.data ?? []);

    const prodMap = new Map<string, TopProduct>();
    (topItemsRes.data ?? []).forEach((it: any) => {
      const key = it.product_name;
      const cur = prodMap.get(key) ?? { name: key, qty: 0, revenue: 0 };
      cur.qty += Number(it.qty ?? 0);
      cur.revenue += Number(it.line_total ?? 0);
      prodMap.set(key, cur);
    });
    setTopProducts([...prodMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5));

    const cityMap = new Map<string, number>();
    (ordersForCities.data ?? []).forEach((o: any) => {
      const city = o.shipping_address?.city ?? o.shipping_address?.cityName ?? tr("غير محدد", "Unknown");
      cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
    });
    setTopCities([...cityMap.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5));

    const payMap = new Map<string, number>();
    (ordersForPayments.data ?? []).forEach((o: any) => {
      const m = o.payment_method ?? "cod";
      payMap.set(m, (payMap.get(m) ?? 0) + 1);
    });
    setPayments([...payMap.entries()]
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count));
  }

  const fmt = (n: number) =>
    `${n.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 0 })} ${tr("ر.س", "SAR")}`;

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{tr("نظرة عامة", "Overview")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{tr("آخر 30 يوماً", "Last 30 days")}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {stats && (stats.ordersOverdue > 0 || stats.lowStockCount > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {stats.ordersOverdue > 0 && (
            <Link to="/admin/orders" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 hover:bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {stats.ordersOverdue} {tr("طلبات معلقة متأخرة", "overdue pending orders")}
                </div>
                <div className="text-xs text-muted-foreground">{tr("منذ أكثر من 3 أيام", "More than 3 days old")}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
          {stats.lowStockCount > 0 && (
            <Link to="/admin/inventory" className="flex items-center gap-3 rounded-xl border border-amber-300/30 bg-amber-50/50 p-4 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30">
              <Package className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {stats.lowStockCount} {tr("منتجات منخفضة المخزون", "products low on stock")}
                </div>
                <div className="text-xs text-muted-foreground">{tr("≤ 5 قطع متبقية", "≤ 5 units remaining")}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard label={tr("مبيعات اليوم", "Today's sales")} value={stats ? fmt(stats.salesToday) : "—"} icon={TrendingUp} accent="primary" />
        <KpiCard label={tr("مبيعات الأسبوع", "This week's sales")} value={stats ? fmt(stats.salesWeek) : "—"} icon={TrendingUp} />
        <KpiCard label={tr("مبيعات الشهر", "This month's sales")} value={stats ? fmt(stats.salesMonth) : "—"} icon={TrendingUp} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={tr("عدد الطلبات", "Orders")} value={stats?.ordersCount ?? "—"} icon={ShoppingBag} small />
        <KpiCard label={tr("متوسط قيمة الطلب", "Average order value")} value={stats ? fmt(stats.aov) : "—"} icon={Wallet} small />
        <KpiCard label={tr("عملاء جدد", "New customers")} value={stats?.newCustomers ?? "—"} icon={Users} small />
        <KpiCard label={tr("الزوار", "Visitors")} value={stats?.visits ?? "—"} icon={Eye} small />
        <KpiCard label={tr("معدل التحويل", "Conversion rate")} value={stats ? `${stats.conversion.toFixed(1)}%` : "—"} icon={Percent} small />
        <KpiCard label={tr("سلات متروكة", "Abandoned carts")} value={stats?.abandonedCarts ?? "—"} icon={ShoppingCart} small link="/admin/abandoned" />
        <KpiCard label={tr("بانتظار الشحن", "Awaiting shipment")} value={stats?.ordersAwaitingShip ?? "—"} icon={Truck} small link="/admin/orders" />
        <KpiCard label={tr("طلبات معلقة", "Pending orders")} value={stats?.ordersPending ?? "—"} icon={AlertTriangle} small link="/admin/orders" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel title={tr("المنتجات الأكثر مبيعاً", "Best-selling products")} link="/admin/products" tr={tr}>
          {topProducts.length === 0 ? (
            <Empty>{tr("لا توجد بيانات", "No data yet")}</Empty>
          ) : (
            <ul className="space-y-2">
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{fmt(p.revenue)}</div>
                  </div>
                  <span className="text-xs font-medium text-foreground">{p.qty} {tr("قطعة", "units")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={tr("المدن الأعلى طلباً", "Top cities by orders")} icon={MapPin} tr={tr}>
          {topCities.length === 0 ? (
            <Empty>{tr("لا توجد بيانات", "No data yet")}</Empty>
          ) : (
            <ul className="space-y-2">
              {topCities.map((c) => {
                const max = topCities[0]?.count || 1;
                const pct = (c.count / max) * 100;
                return (
                  <li key={c.city}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-foreground">{c.city}</span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={tr("طرق الدفع", "Payment methods")} icon={Wallet} tr={tr}>
          {payments.length === 0 ? (
            <Empty>{tr("لا توجد بيانات", "No data yet")}</Empty>
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => {
                const total = payments.reduce((s, x) => s + x.count, 0);
                const pct = (p.count / total) * 100;
                return (
                  <li key={p.method}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-foreground">{paymentLabel(p.method, tr)}</span>
                      <span className="text-muted-foreground">{p.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title={tr("آخر الطلبات", "Recent orders")} link="/admin/orders" tr={tr}>
            {recentOrders.length === 0 ? (
              <Empty>{tr("لا توجد طلبات بعد", "No orders yet")}</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-right text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pl-4">{tr("رقم الطلب", "Order #")}</th>
                      <th className="py-2 pl-4">{tr("العميل", "Customer")}</th>
                      <th className="py-2 pl-4">{tr("المبلغ", "Total")}</th>
                      <th className="py-2 pl-4">{tr("الحالة", "Status")}</th>
                      <th className="py-2">{tr("التاريخ", "Date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pl-4 font-mono text-xs">{o.order_number}</td>
                        <td className="py-2.5 pl-4">{o.customer_name}</td>
                        <td className="py-2.5 pl-4">{fmt(Number(o.total))}</td>
                        <td className="py-2.5 pl-4"><StatusBadge status={o.status} /></td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title={tr("مخزون منخفض", "Low stock")} link="/admin/inventory" icon={Package} tr={tr}>
          {lowStock.length === 0 ? (
            <Empty>{tr("المخزون بصحة جيدة ✓", "Stock is healthy ✓")}</Empty>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((p: any) => (
                <li key={p.id} className="flex items-center gap-2.5 rounded-md border border-border/50 p-2">
                  {p.image_url && (
                    <img src={p.image_url} alt="" className="h-9 w-9 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">
                      {(lang === "ar" ? p.name_ar : p.name_en) || p.name_ar || p.name_en}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{tr("متبقي", "Remaining")}: {p.stock}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.stock === 0 ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800"}`}>
                    {p.stock === 0 ? tr("نفد", "Out") : tr("منخفض", "Low")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

function paymentLabel(m: string, tr: (ar: string, en: string) => string) {
  const map: Record<string, string> = {
    card: tr("بطاقة", "Card"),
    cod: tr("الدفع عند الاستلام", "Cash on delivery"),
    bank_transfer: tr("تحويل بنكي", "Bank transfer"),
    apple_pay: "Apple Pay",
    stripe: "Stripe",
  };
  return map[m] ?? m;
}

function KpiCard({
  label, value, icon: Icon, accent, small, link,
}: {
  label: string; value: string | number;
  icon: typeof TrendingUp; accent?: "primary"; small?: boolean; link?: string;
}) {
  const inner = (
    <div className={`rounded-xl border p-4 transition ${
      accent === "primary"
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-card hover:border-foreground/20"
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent === "primary" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 font-semibold text-foreground ${small ? "text-lg" : "text-xl"}`}>
        {value}
      </div>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function Panel({
  title, children, link, icon: Icon, tr,
}: {
  title: string; children: React.ReactNode;
  link?: string; icon?: typeof TrendingUp;
  tr: (ar: string, en: string) => string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </h2>
        {link && (
          <Link to={link} className="flex items-center gap-1 text-xs text-primary hover:underline">
            {tr("عرض الكل", "View all")} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

export function StatusBadge({ status }: { status: string }) {
  // Note: this component is exported and used by other admin pages — keep
  // the labels translated via a hook would change its signature, so we
  // resolve labels via a small inline lookup using the language stored on
  // <html lang="..."> set by LanguageContext.
  const lang =
    typeof document !== "undefined" && document.documentElement.lang === "en"
      ? "en"
      : "ar";
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    processing: "bg-indigo-100 text-indigo-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  };
  const labelsAr: Record<string, string> = {
    pending: "معلق",
    paid: "مدفوع",
    processing: "قيد التجهيز",
    shipped: "تم الشحن",
    delivered: "تم التوصيل",
    cancelled: "ملغي",
    refunded: "مسترد",
  };
  const labelsEn: Record<string, string> = {
    pending: "Pending",
    paid: "Paid",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  const labels = lang === "en" ? labelsEn : labelsAr;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100"}`}>
      {labels[status] ?? status}
    </span>
  );
}
