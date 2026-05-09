import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import {
  Loader2, Activity, AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, Webhook, ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { format, subHours } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/webhooks-health")({
  component: WebhooksHealthPage,
});

type Range = "1h" | "24h" | "7d" | "30d";
type Endpoint = {
  id: string; name: string; url: string; enabled: boolean;
  events: string[]; failure_count: number;
  last_delivery_at: string | null; last_delivery_status: number | null;
};
type Delivery = {
  id: string; endpoint_id: string | null; event_type: string; status: string;
  http_status: number | null; attempt: number; max_attempts: number;
  error_message: string | null; created_at: string; delivered_at: string | null;
};

const rangeHours: Record<Range, number> = { "1h": 1, "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

function WebhooksHealthPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);

  const [range, setRange] = useState<Range>("24h");
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const load = async () => {
    setLoading(true);
    const since = subHours(new Date(), rangeHours[range]).toISOString();
    const [ep, dv] = await Promise.all([
      supabase.from("webhook_endpoints").select("*").order("name", { ascending: true }),
      supabase.from("webhook_deliveries").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
    ]);
    if (ep.error) toast.error(ep.error.message);
    if (dv.error) toast.error(dv.error.message);
    setEndpoints((ep.data as Endpoint[]) || []);
    setDeliveries((dv.data as Delivery[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel("wh-health")
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_deliveries" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_endpoints" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const stats = useMemo(() => {
    const total = deliveries.length;
    const success = deliveries.filter(d => d.status === "success").length;
    const failed = deliveries.filter(d => d.status === "failed").length;
    const retrying = deliveries.filter(d => d.status === "retrying" || d.status === "pending").length;
    const successRate = total ? (success / total) * 100 : 0;
    const latencies = deliveries
      .filter(d => d.delivered_at && d.created_at)
      .map(d => new Date(d.delivered_at!).getTime() - new Date(d.created_at).getTime())
      .filter(n => n >= 0 && n < 5 * 60 * 1000);
    const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    return { total, success, failed, retrying, successRate, avgLatency, p95 };
  }, [deliveries]);

  // bucket per hour or day
  const series = useMemo(() => {
    const bucketMs = rangeHours[range] <= 24 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const map = new Map<number, { t: number; success: number; failed: number; latency: number; count: number }>();
    for (const d of deliveries) {
      const ts = new Date(d.created_at).getTime();
      const k = Math.floor(ts / bucketMs) * bucketMs;
      const b = map.get(k) || { t: k, success: 0, failed: 0, latency: 0, count: 0 };
      if (d.status === "success") b.success += 1;
      if (d.status === "failed") b.failed += 1;
      if (d.delivered_at) {
        const lat = new Date(d.delivered_at).getTime() - ts;
        if (lat >= 0 && lat < 5 * 60 * 1000) { b.latency += lat; b.count += 1; }
      }
      map.set(k, b);
    }
    return [...map.values()].sort((a, b) => a.t - b.t).map(b => ({
      label: format(new Date(b.t), bucketMs >= 86400000 ? "MM-dd" : "HH:mm"),
      success: b.success, failed: b.failed,
      avgLatency: b.count ? Math.round(b.latency / b.count) : 0,
    }));
  }, [deliveries, range]);

  const perEndpoint = useMemo(() => {
    return endpoints.map(ep => {
      const dvs = deliveries.filter(d => d.endpoint_id === ep.id);
      const success = dvs.filter(d => d.status === "success").length;
      const failed = dvs.filter(d => d.status === "failed").length;
      const total = dvs.length;
      const lats = dvs.filter(d => d.delivered_at).map(d => new Date(d.delivered_at!).getTime() - new Date(d.created_at).getTime()).filter(n => n >= 0);
      const avg = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
      const lastFailed = dvs.find(d => d.status === "failed");
      const health = ep.failure_count >= 5 ? "critical" : ep.failure_count >= 1 ? "warning" : total === 0 ? "idle" : "healthy";
      return { ep, total, success, failed, avg, lastFailed, health };
    });
  }, [endpoints, deliveries]);

  const recentFailures = useMemo(() => deliveries.filter(d => d.status === "failed").slice(0, 10), [deliveries]);

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={{ ar: "صحة الـ Webhooks", en: "Webhooks Health" }}
        subtitle={{ ar: "حالة آخر تنفيذ، النجاح/الفشل، وزمن الاستجابة", en: "Latest run status, success/failure, response times" }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["1h", "24h", "7d", "30d"] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-md text-sm border ${range === r ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
            {r}
          </button>
        ))}
        <button onClick={load} className="ms-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border bg-background hover:bg-muted">
          <RefreshCw className="size-4" /> {t("تحديث", "Refresh")}
        </button>
        <Link to="/admin/webhooks" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border bg-background hover:bg-muted">
          <Webhook className="size-4" /> {t("إدارة", "Manage")}
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={<Activity className="size-4" />} label={t("إجمالي التسليمات", "Total deliveries")} value={stats.total.toString()} />
            <Kpi icon={<CheckCircle2 className="size-4 text-emerald-500" />} label={t("معدل النجاح", "Success rate")} value={`${stats.successRate.toFixed(1)}%`} />
            <Kpi icon={<XCircle className="size-4 text-rose-500" />} label={t("الفشل", "Failed")} value={stats.failed.toString()} hint={`${stats.retrying} ${t("قيد الإعادة", "retrying")}`} />
            <Kpi icon={<Clock className="size-4" />} label={t("متوسط/الـ95", "Avg / P95")} value={`${Math.round(stats.avgLatency)}ms`} hint={`P95 ${Math.round(stats.p95)}ms`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Card title={t("النجاح/الفشل عبر الزمن", "Success vs Failed")}>
              {series.length === 0 ? <Empty ar={ar} /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success" stackId="a" fill="hsl(var(--primary))" name={t("نجاح", "Success")} />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" name={t("فشل", "Failed")} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card title={t("متوسط زمن الاستجابة (ms)", "Average response time (ms)")}>
              {series.length === 0 ? <Empty ar={ar} /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgLatency" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Card title={t("حالة المنصات", "Endpoints status")}>
            {perEndpoint.length === 0 ? <Empty ar={ar} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-xs">
                    <tr className="border-b">
                      <th className="text-start py-2 px-2">{t("الاسم", "Name")}</th>
                      <th className="text-start py-2 px-2">{t("الحالة", "Status")}</th>
                      <th className="text-start py-2 px-2">{t("آخر تنفيذ", "Last run")}</th>
                      <th className="text-start py-2 px-2">{t("الكود", "Code")}</th>
                      <th className="text-start py-2 px-2">{t("نجاح/فشل", "Succ/Fail")}</th>
                      <th className="text-start py-2 px-2">{t("متوسط الزمن", "Avg latency")}</th>
                      <th className="text-start py-2 px-2">{t("متتالية الفشل", "Failure streak")}</th>
                      <th className="text-start py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {perEndpoint.map(({ ep, total, success, failed, avg, health }) => (
                      <tr key={ep.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">
                          <div className="font-medium">{ep.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">{ep.url}</div>
                        </td>
                        <td className="py-2 px-2"><HealthBadge state={health} ar={ar} enabled={ep.enabled} /></td>
                        <td className="py-2 px-2 text-xs">{ep.last_delivery_at ? format(new Date(ep.last_delivery_at), "MM-dd HH:mm") : "—"}</td>
                        <td className="py-2 px-2"><StatusCode code={ep.last_delivery_status} /></td>
                        <td className="py-2 px-2 text-xs">
                          <span className="text-emerald-600">{success}</span> / <span className="text-rose-600">{failed}</span>
                          <span className="text-muted-foreground"> ({total})</span>
                        </td>
                        <td className="py-2 px-2 text-xs">{avg ? `${Math.round(avg)}ms` : "—"}</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs font-medium ${ep.failure_count >= 5 ? "text-rose-600" : ep.failure_count > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {ep.failure_count}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <Link to="/admin/webhooks/$id" params={{ id: ep.id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            {t("تفاصيل", "Details")} <ExternalLink className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={t("آخر حالات الفشل", "Recent failures")}>
            {recentFailures.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-4">
                <CheckCircle2 className="size-4" /> {t("لا توجد أعطال مؤخرًا", "No recent failures")}
              </div>
            ) : (
              <ul className="divide-y">
                {recentFailures.map(d => {
                  const ep = endpoints.find(e => e.id === d.endpoint_id);
                  return (
                    <li key={d.id} className="py-2 flex items-start gap-3">
                      <AlertTriangle className="size-4 text-rose-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{ep?.name || t("غير معروف", "Unknown")} — <span className="text-muted-foreground">{d.event_type}</span></div>
                        <div className="text-xs text-muted-foreground truncate">
                          {format(new Date(d.created_at), "MM-dd HH:mm")} · {t("محاولة", "attempt")} {d.attempt}/{d.max_attempts}
                          {d.http_status ? ` · HTTP ${d.http_status}` : ""}
                          {d.error_message ? ` · ${d.error_message.slice(0, 120)}` : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}
function Empty({ ar }: { ar: boolean }) {
  return <div className="text-sm text-muted-foreground py-8 text-center">{ar ? "لا توجد بيانات" : "No data"}</div>;
}
function HealthBadge({ state, ar, enabled }: { state: string; ar: boolean; enabled: boolean }) {
  if (!enabled) return <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{ar ? "معطّل" : "Disabled"}</span>;
  const map: Record<string, { cls: string; ar: string; en: string }> = {
    healthy: { cls: "bg-emerald-500/15 text-emerald-600", ar: "سليم", en: "Healthy" },
    warning: { cls: "bg-amber-500/15 text-amber-600", ar: "تحذير", en: "Warning" },
    critical: { cls: "bg-rose-500/15 text-rose-600", ar: "عطل", en: "Critical" },
    idle: { cls: "bg-muted text-muted-foreground", ar: "خامل", en: "Idle" },
  };
  const m = map[state] || map.idle;
  return <span className={`px-2 py-0.5 rounded text-xs ${m.cls}`}>{ar ? m.ar : m.en}</span>;
}
function StatusCode({ code }: { code: number | null }) {
  if (!code) return <span className="text-xs text-muted-foreground">—</span>;
  const ok = code >= 200 && code < 300;
  return <span className={`text-xs font-mono ${ok ? "text-emerald-600" : "text-rose-600"}`}>{code}</span>;
}
