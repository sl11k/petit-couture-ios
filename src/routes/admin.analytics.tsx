import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<{
    pageViews: number;
    uniqueSessions: number;
    addToCart: number;
    checkoutStarted: number;
    purchases: number;
    abandonedCarts: any[];
    topProducts: { name: string; views: number }[];
    daily: { date: string; views: number; orders: number }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

      const { data: events } = await supabase
        .from("analytics_events")
        .select("*")
        .gte("created_at", since)
        .limit(5000);

      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, created_at")
        .gte("created_at", since);

      const { data: carts } = await supabase
        .from("abandoned_carts")
        .select("*")
        .eq("converted", false)
        .order("updated_at", { ascending: false })
        .limit(50);

      const evs = events ?? [];
      const pageViews = evs.filter((e) => e.event_name === "page_view").length;
      const uniqueSessions = new Set(evs.map((e) => e.session_id)).size;
      const addToCart = evs.filter((e) => e.event_name === "add_to_cart").length;
      const checkoutStarted = evs.filter((e) => e.event_name === "checkout_started").length;
      const purchases = (orders ?? []).length;

      const productViews: Record<string, number> = {};
      evs.filter((e) => e.event_name === "product_view").forEach((e) => {
        const name = (e.metadata as any)?.name ?? "—";
        productViews[name] = (productViews[name] ?? 0) + 1;
      });
      const topProducts = Object.entries(productViews)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, views]) => ({ name, views }));

      const daily: Record<string, { views: number; orders: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
        daily[d] = { views: 0, orders: 0 };
      }
      evs.filter((e) => e.event_name === "page_view").forEach((e) => {
        const d = e.created_at.slice(0, 10);
        if (daily[d]) daily[d].views++;
      });
      (orders ?? []).forEach((o) => {
        const d = o.created_at.slice(0, 10);
        if (daily[d]) daily[d].orders++;
      });
      const dailyArr = Object.entries(daily)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v }));

      setData({
        pageViews,
        uniqueSessions,
        addToCart,
        checkoutStarted,
        purchases,
        abandonedCarts: carts ?? [],
        topProducts,
        daily: dailyArr,
      });
    })();
  }, [days]);

  const conversion = data && data.uniqueSessions > 0 ? (data.purchases / data.uniqueSessions) * 100 : 0;
  const cartAbandon =
    data && data.checkoutStarted > 0
      ? ((data.checkoutStarted - data.purchases) / data.checkoutStarted) * 100
      : 0;
  const maxView = Math.max(1, ...(data?.daily ?? []).map((d) => d.views));

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">التحليلات</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value={1}>اليوم</option>
          <option value={7}>7 أيام</option>
          <option value={30}>30 يوم</option>
          <option value={90}>90 يوم</option>
        </select>
      </div>

      {!data ? (
        <p className="mt-6 text-sm text-muted-foreground">جاري التحميل...</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Card label="الزيارات" value={data.pageViews} />
            <Card label="جلسات فريدة" value={data.uniqueSessions} />
            <Card label="إضافة للسلة" value={data.addToCart} />
            <Card label="بدء الدفع" value={data.checkoutStarted} />
            <Card label="مشتريات" value={data.purchases} accent />
            <Card label="معدل التحويل" value={`${conversion.toFixed(1)}%`} />
            <Card label="هجر السلة" value={`${cartAbandon.toFixed(1)}%`} />
            <Card label="سلات مهجورة" value={data.abandonedCarts.length} />
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-base font-semibold">الزيارات اليومية</h2>
            <div className="flex h-40 items-end gap-1">
              {data.daily.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${(d.views / maxView) * 100}%`, minHeight: "2px" }}
                    title={`${d.views} زيارة، ${d.orders} طلب`}
                  />
                  <div className="text-[9px] text-muted-foreground">{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-base font-semibold">أكثر المنتجات مشاهدة</h2>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا بيانات بعد.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.topProducts.map((p) => (
                    <li key={p.name} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.views}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-base font-semibold">سلات مهجورة حديثة</h2>
              {data.abandonedCarts.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.abandonedCarts.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-xs">{c.email || c.session_id.slice(0, 12)}</span>
                      <span>{Number(c.subtotal).toFixed(0)} {c.currency}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Card({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
