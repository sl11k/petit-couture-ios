import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Loader2, Activity, AlertTriangle, Gauge, Cpu } from "lucide-react";
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
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export const Route = createFileRoute("/admin/metrics")({
  component: MetricsPage,
});

type Range = "24h" | "7d" | "30d" | "90d" | "custom";

function MetricsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState<string>(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<any[]>([]);
  const [errs, setErrs] = useState<any[]>([]);
  const [perf, setPerf] = useState<any[]>([]);

  // Sync presets with date inputs
  useEffect(() => {
    if (range === "custom") return;
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    setFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setTo(format(new Date(), "yyyy-MM-dd"));
  }, [range]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const [apiR, errR, perfR] = await Promise.all([
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
      ]);
      setApi(apiR.data ?? []);
      setErrs(errR.data ?? []);
      setPerf(perfR.data ?? []);
      setLoading(false);
    })();
  }, [from, to]);

  const stats = useMemo(() => {
    const durations = api.map((r) => r.duration_ms).filter((v: any) => typeof v === "number");
    durations.sort((a, b) => a - b);
    const p = (q: number) => (durations.length ? durations[Math.floor(durations.length * q)] : 0);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const errorRate = api.length
      ? Math.round(
          (api.filter((r) => (r.status_code ?? 0) >= 500).length / api.length) * 1000,
        ) / 10
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

  // Time-bucketed series
  const series = useMemo(() => {
    const bucketMinutes = range === "24h" ? 60 : 60 * 24; // hourly vs daily
    const map = new Map<string, { ts: string; req: number; err5xx: number; total_ms: number; n: number; errors: number }>();
    for (const r of api) {
      const d = new Date(r.created_at);
      const k =
        bucketMinutes === 60
          ? format(d, "MM-dd HH:00")
          : format(startOfDay(d), "MM-dd");
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
      const k =
        bucketMinutes === 60
          ? format(d, "MM-dd HH:00")
          : format(startOfDay(d), "MM-dd");
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
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      return { metric, p75: Math.round(p75), avg, samples: vals.length };
    });
  }, [perf]);

  const errorsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of errs) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return Array.from(map, ([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  }, [errs]);

  return (
    <div>
      <PageHeader
        title={{ ar: "مؤشرات الأداء", en: "Performance Metrics" }}
        description={{
          ar: "زمن الاستجابة، الأخطاء، واستخدام الموارد",
          en: "Response time, errors, and resource usage",
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
      ) : (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi icon={Activity} label={ar ? "الطلبات" : "Requests"} value={stats.requests.toLocaleString()} />
            <Kpi
              icon={AlertTriangle}
              label={ar ? "نسبة الأخطاء 5xx" : "5xx Error rate"}
              value={`${stats.errorRate}%`}
              tone={stats.errorRate > 2 ? "danger" : stats.errorRate > 0.5 ? "warn" : "ok"}
            />
            <Kpi icon={Gauge} label={ar ? "متوسط الاستجابة" : "Avg latency"} value={`${stats.avg} ms`} />
            <Kpi icon={Gauge} label="P95 / P99" value={`${stats.p95} / ${stats.p99} ms`} />
            <Kpi icon={AlertTriangle} label={ar ? "أخطاء مسجّلة" : "Errors logged"} value={stats.errors.toLocaleString()} />
            <Kpi
              icon={AlertTriangle}
              label={ar ? "حرجة" : "Critical"}
              value={stats.criticals.toString()}
              tone={stats.criticals ? "danger" : "ok"}
            />
            <Kpi
              icon={AlertTriangle}
              label={ar ? "غير محلولة" : "Unresolved"}
              value={stats.unresolved.toString()}
              tone={stats.unresolved ? "warn" : "ok"}
            />
            <Kpi icon={Cpu} label={ar ? "عينات الأداء" : "Perf samples"} value={perf.length.toLocaleString()} />
          </div>

          {/* Latency over time */}
          <Card title={ar ? "زمن الاستجابة (متوسط/طلبات)" : "Latency & Requests over time"}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="l" type="monotone" dataKey="avg_ms" name={ar ? "متوسط (ms)" : "avg ms"} stroke="hsl(var(--primary))" dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="req" name={ar ? "طلبات" : "requests"} stroke="hsl(var(--muted-foreground))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Errors over time */}
          <Card title={ar ? "الأخطاء عبر الزمن" : "Errors over time"}>
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
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Web Vitals */}
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

            {/* Errors by category */}
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
