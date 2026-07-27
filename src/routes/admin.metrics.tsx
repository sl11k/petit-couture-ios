import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import {
  Loader2,
  Activity,
  AlertTriangle,
  Gauge,
  Cpu,
  ShoppingBag,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area,
} from "recharts";

export const Route = createFileRoute("/admin/metrics")({
  component: MetricsPage,
});

type Range = "24h" | "7d" | "30d" | "90d" | "custom";

// ----- date helpers (local, no external dep needed) -----
const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDay = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHour = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
const subDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
};
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function MetricsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState<string>(fmtDate(subDays(new Date(), 7)));
  const [to, setTo] = useState<string>(fmtDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [api, setApi] = useState<any[]>([]);
  const [errs, setErrs] = useState<any[]>([]);
  const [perf, setPerf] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // sync preset -> dates
  useEffect(() => {
    if (range === "custom") return;
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    setFrom(fmtDate(subDays(new Date(), days)));
    setTo(fmtDate(new Date()));
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const fromIso = new Date(from + "T00:00:00").toISOString();
        const toIso = new Date(to + "T23:59:59").toISOString();

        // We fetch a wider window (last 60 days) for orders/sessions so we can
        // compute today-vs-yesterday and this-week-vs-last comparisons no
        // matter what preset the user picked.
        const compareSince = subDays(new Date(), 60).toISOString();

        const [apiR, errR, perfR, ordersR, sessR] = await Promise.all([
          supabase
            .from("api_request_logs")
            .select("status_code,duration_ms,path,created_at")
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase
            .from("error_logs")
            .select("severity,category,code,created_at,resolved")
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase
            .from("perf_metrics")
            .select("metric,value,rating,created_at")
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase
            .from("orders")
            .select("total,refunded_amount,status,payment_status,created_at")
            .gte("created_at", compareSince)
            .eq("payment_status", "paid")
            .limit(10000),
          supabase
            .from("analytics_events")
            .select("session_id,created_at")
            .gte("created_at", compareSince)
            .limit(20000),
        ]);

        if (cancelled) return;
        setApi(apiR.data ?? []);
        setErrs(errR.data ?? []);
        setPerf(perfR.data ?? []);
        setOrders((ordersR.data ?? []).filter((order: any) => !["cancelled", "refunded", "returned", "payment_failed"].includes(String(order.status))));
        setSessions(sessR.data ?? []);
      } catch (e: any) {
        if (!cancelled) setLoadErr(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // ---------------- stats (over selected range) ----------------
  const stats = useMemo(() => {
    const durations = api.map((r) => r.duration_ms).filter((v: any) => typeof v === "number");
    durations.sort((a, b) => a - b);
    const p = (q: number) => (durations.length ? durations[Math.floor(durations.length * q)] : 0);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const errorRate = api.length
      ? Math.round((api.filter((r) => (r.status_code ?? 0) >= 500).length / api.length) * 1000) / 10
      : 0;
    return {
      requests: api.length,
      errorRate,
      avg,
      p50: p(0.5),
      p95: p(0.95),
      p99: p(0.99),
      errors: errs.length,
      criticals: errs.filter((e) => e.severity === "critical").length,
      unresolved: errs.filter((e) => !e.resolved).length,
    };
  }, [api, errs]);

  // ---------------- day-over-day / week-over-week comparison ----------------
  const comparison = useMemo(() => {
    const now = new Date();
    const startToday = startOfDay(now).getTime();
    const startYesterday = startOfDay(subDays(now, 1)).getTime();
    const startWeek = startOfDay(subDays(now, 7)).getTime();
    const startPrevWeek = startOfDay(subDays(now, 14)).getTime();

    const bucket = (rows: any[], amount: (r: any) => number) => {
      let today = 0,
        yesterday = 0,
        thisWeek = 0,
        prevWeek = 0;
      for (const r of rows) {
        const t = new Date(r.created_at).getTime();
        const v = amount(r);
        if (t >= startToday) today += v;
        else if (t >= startYesterday) yesterday += v;
        if (t >= startWeek) thisWeek += v;
        else if (t >= startPrevWeek) prevWeek += v;
      }
      return { today, yesterday, thisWeek, prevWeek };
    };

    const rev = bucket(orders, (o) => Math.max(0, Number(o.total ?? 0) - Number(o.refunded_amount ?? 0)));
    const ord = bucket(orders, () => 1);
    const errC = bucket(errs, () => 1);
    const uniq = (rows: any[], from: number, to?: number) => {
      const s = new Set<string>();
      for (const r of rows) {
        const t = new Date(r.created_at).getTime();
        if (t >= from && (to === undefined || t < to) && r.session_id) s.add(r.session_id);
      }
      return s.size;
    };
    const ses = {
      today: uniq(sessions, startToday),
      yesterday: uniq(sessions, startYesterday, startToday),
      thisWeek: uniq(sessions, startWeek),
      prevWeek: uniq(sessions, startPrevWeek, startWeek),
    };

    return { rev, ord, errC, ses };
  }, [orders, errs, sessions]);

  // ---------------- daily series (last 30 days) ----------------
  const daily = useMemo(() => {
    const days = 30;
    const start = startOfDay(subDays(new Date(), days - 1));
    const map = new Map<string, { day: string; label: string; revenue: number; orders: number; sessions: Set<string>; errors: number }>();
    for (let i = 0; i < days; i++) {
      const d = subDays(new Date(), days - 1 - i);
      const key = fmtDate(startOfDay(d));
      map.set(key, { day: key, label: fmtDay(d), revenue: 0, orders: 0, sessions: new Set(), errors: 0 });
    }
    for (const o of orders) {
      const t = new Date(o.created_at);
      if (t < start) continue;
      const key = fmtDate(startOfDay(t));
      const b = map.get(key);
      if (b) {
        b.orders += 1;
        b.revenue += Math.max(0, Number(o.total ?? 0) - Number(o.refunded_amount ?? 0));
      }
    }
    for (const s of sessions) {
      const t = new Date(s.created_at);
      if (t < start) continue;
      const key = fmtDate(startOfDay(t));
      const b = map.get(key);
      if (b && s.session_id) b.sessions.add(s.session_id);
    }
    for (const e of errs) {
      const t = new Date(e.created_at);
      if (t < start) continue;
      const key = fmtDate(startOfDay(t));
      const b = map.get(key);
      if (b) b.errors += 1;
    }
    return Array.from(map.values()).map((b) => ({
      label: b.label,
      revenue: Math.round(b.revenue),
      orders: b.orders,
      sessions: b.sessions.size,
      errors: b.errors,
    }));
  }, [orders, sessions, errs]);

  // ---------------- time series (latency/errors within selected range) ----------------
  const series = useMemo(() => {
    const bucketHourly = range === "24h";
    const map = new Map<string, { ts: string; req: number; err5xx: number; total_ms: number; n: number; errors: number }>();
    for (const r of api) {
      const d = new Date(r.created_at);
      const k = bucketHourly ? fmtHour(d) : fmtDay(startOfDay(d));
      const cur = map.get(k) ?? { ts: k, req: 0, err5xx: 0, total_ms: 0, n: 0, errors: 0 };
      cur.req++;
      if ((r.status_code ?? 0) >= 500) cur.err5xx++;
      if (typeof r.duration_ms === "number") {
        cur.total_ms += r.duration_ms;
        cur.n++;
      }
      map.set(k, cur);
    }
    for (const e of errs) {
      const d = new Date(e.created_at);
      const k = bucketHourly ? fmtHour(d) : fmtDay(startOfDay(d));
      const cur = map.get(k) ?? { ts: k, req: 0, err5xx: 0, total_ms: 0, n: 0, errors: 0 };
      cur.errors++;
      map.set(k, cur);
    }
    return Array.from(map.values())
      .map((b) => ({ ...b, avg_ms: b.n ? Math.round(b.total_ms / b.n) : 0 }))
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [api, errs, range]);

  const webVitals = useMemo(() => {
    const groups: Record<string, number[]> = {};
    for (const r of perf) {
      if (!groups[r.metric]) groups[r.metric] = [];
      groups[r.metric].push(Number(r.value));
    }
    return Object.entries(groups).map(([metric, vals]) => {
      vals.sort((a, b) => a - b);
      const p75 = vals[Math.floor(vals.length * 0.75)] ?? 0;
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      return { metric, p75: Math.round(p75), avg, samples: vals.length };
    });
  }, [perf]);

  const errorsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of errs) map.set(e.category ?? "—", (map.get(e.category ?? "—") ?? 0) + 1);
    return Array.from(map, ([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  }, [errs]);

  const nf = (n: number) => n.toLocaleString(ar ? "ar" : "en");

  return (
    <div>
      <PageHeader
        title={{ ar: "المؤشرات والتحليلات اليومية", en: "Metrics & Daily Analytics" }}
        description={{
          ar: "زمن الاستجابة، الأخطاء، ومقارنة اليوم بالأمس والأسبوع بالسابق",
          en: "Response time, errors, and today vs yesterday / week comparisons",
        }}
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "90d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                range === r
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setRange("custom")}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              range === "custom"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {ar ? "مخصص" : "Custom"}
          </button>
        </div>
        <div className="ms-auto flex items-center gap-2 text-xs">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setRange("custom");
            }}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setRange("custom");
            }}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : loadErr ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {ar ? "تعذّر تحميل البيانات: " : "Failed to load data: "}
          {loadErr}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Daily comparison — today vs yesterday */}
          <Card title={ar ? "اليوم مقارنة بالأمس" : "Today vs Yesterday"}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Compare
                icon={DollarSign}
                label={ar ? "الإيرادات" : "Revenue"}
                current={comparison.rev.today}
                previous={comparison.rev.yesterday}
                suffix={ar ? " ر.س" : " SAR"}
                ar={ar}
              />
              <Compare
                icon={ShoppingBag}
                label={ar ? "الطلبات" : "Orders"}
                current={comparison.ord.today}
                previous={comparison.ord.yesterday}
                ar={ar}
              />
              <Compare
                icon={Users}
                label={ar ? "الجلسات" : "Sessions"}
                current={comparison.ses.today}
                previous={comparison.ses.yesterday}
                ar={ar}
              />
              <Compare
                icon={AlertTriangle}
                label={ar ? "الأخطاء" : "Errors"}
                current={comparison.errC.today}
                previous={comparison.errC.yesterday}
                invert
                ar={ar}
              />
            </div>
          </Card>

          {/* Weekly comparison */}
          <Card title={ar ? "هذا الأسبوع مقارنة بالأسبوع السابق" : "This week vs previous week"}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Compare
                icon={DollarSign}
                label={ar ? "الإيرادات" : "Revenue"}
                current={comparison.rev.thisWeek}
                previous={comparison.rev.prevWeek}
                suffix={ar ? " ر.س" : " SAR"}
                ar={ar}
              />
              <Compare
                icon={ShoppingBag}
                label={ar ? "الطلبات" : "Orders"}
                current={comparison.ord.thisWeek}
                previous={comparison.ord.prevWeek}
                ar={ar}
              />
              <Compare
                icon={Users}
                label={ar ? "الجلسات" : "Sessions"}
                current={comparison.ses.thisWeek}
                previous={comparison.ses.prevWeek}
                ar={ar}
              />
              <Compare
                icon={AlertTriangle}
                label={ar ? "الأخطاء" : "Errors"}
                current={comparison.errC.thisWeek}
                previous={comparison.errC.prevWeek}
                invert
                ar={ar}
              />
            </div>
          </Card>

          {/* Daily trend last 30 days */}
          <Card title={ar ? "التطور اليومي — آخر 30 يوم" : "Daily trend — last 30 days"}>
            {daily.length === 0 ? (
              <Empty ar={ar} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="mrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    yAxisId="l"
                    type="monotone"
                    dataKey="revenue"
                    name={ar ? "الإيرادات" : "Revenue"}
                    stroke="hsl(var(--primary))"
                    fill="url(#mrev)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="r"
                    type="monotone"
                    dataKey="orders"
                    name={ar ? "الطلبات" : "Orders"}
                    stroke="hsl(var(--muted-foreground))"
                    dot={false}
                  />
                  <Line
                    yAxisId="r"
                    type="monotone"
                    dataKey="sessions"
                    name={ar ? "الجلسات" : "Sessions"}
                    stroke="#22c55e"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* KPI cards — performance */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Activity} label={ar ? "الطلبات" : "Requests"} value={nf(stats.requests)} />
            <Kpi
              icon={AlertTriangle}
              label={ar ? "نسبة الأخطاء 5xx" : "5xx Error rate"}
              value={`${stats.errorRate}%`}
              tone={stats.errorRate > 2 ? "danger" : stats.errorRate > 0.5 ? "warn" : "ok"}
            />
            <Kpi icon={Gauge} label={ar ? "متوسط الاستجابة" : "Avg latency"} value={`${stats.avg} ms`} />
            <Kpi icon={Gauge} label="P95 / P99" value={`${stats.p95} / ${stats.p99} ms`} />
            <Kpi icon={AlertTriangle} label={ar ? "أخطاء مسجّلة" : "Errors logged"} value={nf(stats.errors)} />
            <Kpi
              icon={AlertTriangle}
              label={ar ? "حرجة" : "Critical"}
              value={String(stats.criticals)}
              tone={stats.criticals ? "danger" : "ok"}
            />
            <Kpi
              icon={AlertTriangle}
              label={ar ? "غير محلولة" : "Unresolved"}
              value={String(stats.unresolved)}
              tone={stats.unresolved ? "warn" : "ok"}
            />
            <Kpi icon={Cpu} label={ar ? "عينات الأداء" : "Perf samples"} value={nf(perf.length)} />
          </div>

          {/* Latency over time */}
          <Card title={ar ? "زمن الاستجابة (متوسط/طلبات)" : "Latency & Requests over time"}>
            {series.length === 0 ? (
              <Empty ar={ar} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    yAxisId="l"
                    type="monotone"
                    dataKey="avg_ms"
                    name={ar ? "متوسط (ms)" : "avg ms"}
                    stroke="hsl(var(--primary))"
                    dot={false}
                  />
                  <Line
                    yAxisId="r"
                    type="monotone"
                    dataKey="req"
                    name={ar ? "طلبات" : "requests"}
                    stroke="hsl(var(--muted-foreground))"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Errors over time */}
          <Card title={ar ? "الأخطاء عبر الزمن" : "Errors over time"}>
            {series.length === 0 ? (
              <Empty ar={ar} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="err5xx" name="5xx" fill="hsl(var(--destructive))" />
                  <Bar dataKey="errors" name={ar ? "سجل أخطاء" : "logged"} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={ar ? "مؤشرات الأداء (Web Vitals)" : "Web Vitals"}>
              {webVitals.length === 0 ? (
                <Empty ar={ar} />
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 text-start">{ar ? "المقياس" : "Metric"}</th>
                      <th className="py-2 text-end">P75</th>
                      <th className="py-2 text-end">{ar ? "متوسط" : "Avg"}</th>
                      <th className="py-2 text-end">{ar ? "عينات" : "Samples"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webVitals.map((w) => (
                      <tr key={w.metric} className="border-t border-border">
                        <td className="py-1.5 font-medium">{w.metric}</td>
                        <td className="py-1.5 text-end">{w.p75}</td>
                        <td className="py-1.5 text-end">{w.avg}</td>
                        <td className="py-1.5 text-end text-muted-foreground">{w.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title={ar ? "الأخطاء حسب الفئة" : "Errors by category"}>
              {errorsByCategory.length === 0 ? (
                <Empty ar={ar} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={errorsByCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "default" }: any) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "ok"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function Compare({
  icon: Icon,
  label,
  current,
  previous,
  suffix = "",
  invert = false,
  ar,
}: {
  icon: any;
  label: string;
  current: number;
  previous: number;
  suffix?: string;
  invert?: boolean;
  ar: boolean;
}) {
  const diff = current - previous;
  const pct = previous > 0 ? (diff / previous) * 100 : current > 0 ? 100 : 0;
  const up = diff > 0;
  const flat = diff === 0;
  // For "invert" metrics (errors) going up is bad
  const good = flat ? null : invert ? !up : up;
  const toneCls =
    good === null
      ? "text-muted-foreground"
      : good
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-destructive";
  const Arrow = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const fmt = (n: number) => n.toLocaleString(ar ? "ar" : "en", { maximumFractionDigits: 0 });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-xl font-semibold">
        {fmt(current)}
        <span className="text-xs font-normal text-muted-foreground">{suffix}</span>
      </div>
      <div className={`mt-1 flex items-center gap-1 text-[11px] ${toneCls}`}>
        <Arrow className="h-3 w-3" />
        <span>
          {flat
            ? ar
              ? "بدون تغيير"
              : "No change"
            : `${up ? "+" : ""}${fmt(Math.round(diff))} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`}
        </span>
        <span className="text-muted-foreground">
          {ar ? " • السابق " : " • prev "}
          {fmt(previous)}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      {children}
    </div>
  );
}

function Empty({ ar }: any) {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      {ar ? "لا توجد بيانات في النطاق المحدد" : "No data in selected range"}
    </div>
  );
}
