import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ShoppingBag, DollarSign, Users, Package, TrendingUp, Activity, Eye, Clock, MousePointer2, Download, Radio } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

type Range = "today" | "yesterday" | "24h" | "7d" | "14d" | "30d" | "90d" | "month" | "custom";

function bounds(range: Range, from: string, to: string) {
  const now = new Date();
  if (range === "today") return [startOfDay(now), endOfDay(now)];
  if (range === "yesterday") { const d = subDays(now, 1); return [startOfDay(d), endOfDay(d)]; }
  if (range === "month") return [startOfMonth(now), endOfDay(now)];
  if (range === "custom") return [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`)];
  const days = range === "24h" ? 1 : Number(range.replace("d", ""));
  return [new Date(now.getTime() - days * 86400000), now];
}

async function fetchAllEvents(fromIso: string, toIso: string) {
  const all: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("analytics_events")
      .select("session_id,user_id,event_name,path,referrer,metadata,user_agent,created_at")
      .gte("created_at", fromIso).lte("created_at", toIso).order("created_at").range(offset, offset + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

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

function Breakdown({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  const max = rows[0]?.value || 1;
  return <section className="rounded-xl border border-border bg-card p-4">
    <h2 className="mb-3 text-sm font-semibold">{title}</h2>
    <div className="space-y-2">{rows.length ? rows.map(row => <div key={row.name}>
      <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate">{row.name}</span><strong>{row.value.toLocaleString()}</strong></div>
      <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary/70" style={{width:`${row.value/max*100}%`}}/></div>
    </div>) : <p className="py-6 text-center text-xs text-muted-foreground">No data</p>}</div>
  </section>;
}

function AnalyticsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    avgOrder: 0,
    customers: 0,
    sessions: 0,
    visitors: 0,
    pageViews: 0,
    avgDuration: 0,
    bounceRate: 0,
    events: [] as any[],
    topProducts: [] as { name: string; qty: number }[],
    topStatuses: [] as { status: string; count: number }[],
    paidOrders: 0,
    failedPayments: 0,
    payments: [] as any[],
    previousSessions: 0,
    liveVisitors: 0,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [start, finish] = bounds(range, from, to);
      const since = start.toISOString();
      const until = finish.toISOString();
      const duration = finish.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration - 1), prevEnd = new Date(start.getTime() - 1);
      const [ordersRes, events, itemsRes, customersRes, paymentsRes, previousEvents] = await Promise.all([
        supabase.from("orders").select("total, status, payment_status, source, created_at").gte("created_at", since).lte("created_at", until),
        fetchAllEvents(since, until),
        supabase.from("order_items").select("product_name, qty, orders!inner(created_at)").gte("orders.created_at", since).lte("orders.created_at", until),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since).lte("created_at", until),
        supabase.from("payment_transactions").select("status,amount,gateway,created_at").gte("created_at", since).lte("created_at", until),
        fetchAllEvents(prevStart.toISOString(), prevEnd.toISOString()),
      ]);
      const orders = ordersRes.data ?? [];
      const revenue = orders.reduce((s, o: any) => s + Number(o.total ?? 0), 0);
      const avgOrder = orders.length > 0 ? revenue / orders.length : 0;
      const sessions = new Set(events.map((s: any) => s.session_id).filter(Boolean)).size;
      const pageViews = events.filter((e: any) => e.event_name === "page_view").length;
      const visitors = new Set(events.map((e: any) => e.metadata?.visitor_id || e.user_id || e.session_id).filter(Boolean)).size;
      const sessionMap = new Map<string, any[]>();
      events.forEach((e: any) => sessionMap.set(e.session_id, [...(sessionMap.get(e.session_id) || []), e]));
      const durations = Array.from(sessionMap.values()).map(xs => Math.max(0, new Date(xs[xs.length - 1].created_at).getTime() - new Date(xs[0].created_at).getTime()));
      const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const bounced = Array.from(sessionMap.values()).filter(xs => xs.filter((e: any) => e.event_name === "page_view").length <= 1).length;

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
        visitors,
        pageViews,
        avgDuration,
        bounceRate: sessions ? bounced / sessions * 100 : 0,
        events,
        paidOrders: orders.filter((o: any) => ["paid", "captured"].includes(o.payment_status)).length,
        failedPayments: (paymentsRes.data ?? []).filter((p: any) => p.status === "failed").length,
        payments: paymentsRes.data ?? [],
        previousSessions: new Set(previousEvents.map((e: any) => e.session_id).filter(Boolean)).size,
        liveVisitors: new Set(events.filter((e: any) => Date.now() - new Date(e.created_at).getTime() <= 120000).map((e: any) => e.metadata?.visitor_id || e.session_id)).size,
        topProducts,
        topStatuses,
      });
      setLoading(false);
    })();
  }, [range, from, to]);

  const details = useMemo(() => {
    const singleDay = bounds(range, from, to)[1].getTime() - bounds(range, from, to)[0].getTime() <= 86400000;
    const buckets = new Map<string, { label: string; visitors: Set<string>; views: number }>();
    const sources = new Map<string, number>(), pages = new Map<string, number>(), devices = new Map<string, number>(), countries = new Map<string, number>(), campaigns = new Map<string, number>(), events = new Map<string, number>();
    for (const e of stats.events) {
      events.set(e.event_name, (events.get(e.event_name) || 0) + 1);
      if (e.event_name !== "page_view") continue;
      const d = new Date(e.created_at);
      const key = singleDay ? format(d, "HH:00") : format(d, "MM-dd");
      const b = buckets.get(key) || { label: key, visitors: new Set<string>(), views: 0 };
      b.views++; b.visitors.add(e.metadata?.visitor_id || e.session_id); buckets.set(key, b);
      pages.set(e.path || "/", (pages.get(e.path || "/") || 0) + 1);
      let source = "Direct"; try { if (e.referrer) source = new URL(e.referrer).hostname.replace(/^www\./, ""); } catch { /* noop */ }
      sources.set(source, (sources.get(source) || 0) + 1);
      const device = e.metadata?.device || (/mobi|android|iphone/i.test(e.user_agent || "") ? "Mobile" : "Desktop");
      devices.set(device, (devices.get(device) || 0) + 1);
      const country = e.metadata?.country || e.metadata?.country_code;
      if (country) countries.set(country, (countries.get(country) || 0) + 1);
      let campaign = e.metadata?.utm_campaign;
      if (!campaign && e.path?.includes("?")) { try { campaign = new URL(e.path, "https://lppme.com").searchParams.get("utm_campaign"); } catch { /* noop */ } }
      if (campaign) campaigns.set(campaign, (campaigns.get(campaign) || 0) + 1);
    }
    const top = (m: Map<string, number>) => Array.from(m, ([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,10);
    const gateways = new Map<string, number>();
    stats.payments.forEach((p:any)=>gateways.set(`${p.gateway} · ${p.status}`, (gateways.get(`${p.gateway} · ${p.status}`)||0)+1));
    const funnelNames = ["page_view","view_content","add_to_cart","begin_checkout","add_payment_info","purchase"];
    const funnel = funnelNames.map(name=>({name,value:events.get(name)||0}));
    return { series: Array.from(buckets.values()).map(b=>({ label:b.label, visitors:b.visitors.size, views:b.views })).sort((a,b)=>a.label.localeCompare(b.label)), sources:top(sources), pages:top(pages), devices:top(devices), countries:top(countries), campaigns:top(campaigns), events:top(events), gateways:top(gateways), funnel };
  }, [stats.events, stats.payments, range, from, to]);

  const exportCsv = () => {
    const rows = [["time","event","session","path","source","device","country"]];
    stats.events.forEach((e:any)=>rows.push([e.created_at,e.event_name,e.session_id,e.path||"",e.referrer||"",e.metadata?.device||"",e.metadata?.country||e.metadata?.country_code||""]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"})); a.download=`analytics-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const fmt = (n: number) => n.toLocaleString(ar ? "ar" : "en", { maximumFractionDigits: 0 });

  return (
    <div>
      <PageHeader
        title={{ ar: "التحليلات", en: "Analytics" }}
        description={{ ar: "بيانات حقيقية حسب الفترة — توقيت الرياض", en: "Real data by period — Riyadh time" }}
        actions={
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
            <button onClick={exportCsv} className="flex items-center gap-1 rounded px-2.5 py-1 hover:bg-muted"><Download className="h-3 w-3"/>{ar?"تصدير":"Export"}</button>
            {(["today", "yesterday", "24h", "7d", "14d", "30d", "90d", "month"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded px-2.5 py-1 ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {r === "today" ? (ar ? "اليوم" : "Today") : r === "yesterday" ? (ar ? "أمس" : "Yesterday") : r === "month" ? (ar ? "هذا الشهر" : "This month") : r}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-xs">
        <input type="date" value={from} onChange={e=>{setFrom(e.target.value);setRange("custom");}} className="rounded border bg-background px-2 py-1" />
        <span>→</span>
        <input type="date" value={to} onChange={e=>{setTo(e.target.value);setRange("custom");}} className="rounded border bg-background px-2 py-1" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label={ar ? "الزوار" : "Visitors"} value={fmt(stats.visitors)} icon={Users} />
        <StatCard label={ar ? "مشاهدات الصفحات" : "Page views"} value={fmt(stats.pageViews)} icon={Eye} />
        <StatCard label={ar ? "مشاهدات/جلسة" : "Views/session"} value={(stats.pageViews / Math.max(stats.sessions,1)).toFixed(2)} icon={MousePointer2} />
        <StatCard label={ar ? "متوسط مدة الجلسة" : "Avg session"} value={`${Math.floor(stats.avgDuration/60000)}m ${Math.floor(stats.avgDuration/1000)%60}s`} icon={Clock} />
        <StatCard label={ar ? "معدل الارتداد" : "Bounce rate"} value={`${stats.bounceRate.toFixed(1)}%`} icon={Activity} />
        <StatCard label={ar ? "الإيرادات" : "Revenue"} value={`${fmt(stats.revenue)} ${ar ? "ر.س" : "SAR"}`} icon={DollarSign} />
        <StatCard label={ar ? "الطلبات" : "Orders"} value={loading ? "…" : fmt(stats.orders)} icon={ShoppingBag} />
        <StatCard label={ar ? "متوسط الطلب" : "Avg order"} value={`${fmt(stats.avgOrder)} ${ar ? "ر.س" : "SAR"}`} icon={TrendingUp} />
        <StatCard label={ar ? "عملاء جدد" : "New customers"} value={loading ? "…" : fmt(stats.customers)} icon={Users} />
        <StatCard label={ar ? "الجلسات" : "Sessions"} value={loading ? "…" : fmt(stats.sessions)} icon={Activity} />
        <StatCard label={ar ? "معدل التحويل" : "Conversion rate"} value={`${(stats.paidOrders / Math.max(stats.sessions,1) * 100).toFixed(2)}%`} icon={TrendingUp} />
        <StatCard label={ar ? "مدفوعات فاشلة" : "Failed payments"} value={fmt(stats.failedPayments)} icon={Activity} />
        <StatCard label={ar ? "زوار الآن (دقيقتان)" : "Live visitors (2m)"} value={fmt(stats.liveVisitors)} icon={Radio} />
        <StatCard label={ar ? "تغير الجلسات" : "Session change"} value={`${stats.previousSessions ? ((stats.sessions-stats.previousSessions)/stats.previousSessions*100).toFixed(1) : "0.0"}%`} icon={TrendingUp} />
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{ar ? "الزوار والمشاهدات عبر الزمن" : "Visitors and views over time"}</h2>
        <ResponsiveContainer width="100%" height={300}><AreaChart data={details.series}><CartesianGrid strokeDasharray="3 3" opacity={0.2}/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.16}/><Area type="monotone" dataKey="visitors" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.08}/></AreaChart></ResponsiveContainer>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Breakdown title={ar ? "مصادر الزيارات" : "Sources"} rows={details.sources}/>
        <Breakdown title={ar ? "أكثر الصفحات" : "Top pages"} rows={details.pages}/>
        <Breakdown title={ar ? "الأجهزة" : "Devices"} rows={details.devices}/>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Breakdown title={ar ? "مسار التحويل" : "Conversion funnel"} rows={details.funnel}/>
        <Breakdown title={ar ? "بوابات وحالات الدفع" : "Payment gateways and statuses"} rows={details.gateways}/>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Breakdown title={ar ? "الدول (عند توفرها)" : "Countries (when available)"} rows={details.countries}/>
        <Breakdown title={ar ? "الحملات UTM" : "UTM campaigns"} rows={details.campaigns}/>
        <Breakdown title={ar ? "الأحداث ومسار التحويل" : "Events and funnel"} rows={details.events}/>
      </div>

      <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        {ar ? "ملاحظة الدقة: الأرقام محسوبة من سجلات الزيارات والطلبات والمدفوعات الفعلية. الدولة والحملة لا تظهران إلا إذا سُجلتا فعلًا، وقياس المدة والارتداد يصبح أدق للزيارات الجديدة بعد هذا التحديث؛ لا يتم اختلاق بيانات تاريخية مفقودة." : "Accuracy note: metrics come from actual analytics, orders and payment records. Country and campaign appear only when captured. Duration and bounce accuracy improves for new visits after this release; missing historical data is never fabricated."}
      </p>

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
