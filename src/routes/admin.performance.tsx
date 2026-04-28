import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Gauge, AlertTriangle, Smartphone, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PERF_BUDGETS } from "@/lib/perf";

export const Route = createFileRoute("/admin/performance")({
  component: PerfPage,
  head: () => ({ meta: [{ title: "مراقبة الأداء - الإدارة" }] }),
});

interface Row { metric: string; value: number; rating: string; page: string; device: string; created_at: string; }

function PerfPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    (supabase as any).from("perf_metrics").select("*")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(5000)
      .then(({ data }: any) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, [days]);

  function p(metric: string, percentile: number) {
    const vals = rows.filter((r) => r.metric === metric).map((r) => r.value).sort((a, b) => a - b);
    if (!vals.length) return null;
    return vals[Math.floor((percentile / 100) * (vals.length - 1))];
  }

  function poorPct(metric: string) {
    const vs = rows.filter((r) => r.metric === metric);
    if (!vs.length) return 0;
    return Math.round((vs.filter((r) => r.rating === "poor").length / vs.length) * 100);
  }

  const cards = [
    { label: "LCP (p75)", value: p("LCP", 75), unit: "ms", budget: PERF_BUDGETS.LCP_MS, poor: poorPct("LCP") },
    { label: "INP (p75)", value: p("INP", 75), unit: "ms", budget: PERF_BUDGETS.INP_MS, poor: poorPct("INP") },
    { label: "CLS (p75)", value: p("CLS", 75), unit: "", budget: PERF_BUDGETS.CLS, poor: poorPct("CLS") },
    { label: "TTFB (p75)", value: p("TTFB", 75), unit: "ms", budget: PERF_BUDGETS.TTFB_MS, poor: poorPct("TTFB") },
    { label: "FCP (p75)", value: p("FCP", 75), unit: "ms", budget: PERF_BUDGETS.FCP_MS, poor: poorPct("FCP") },
  ];

  // Slowest pages by LCP p75
  const byPage = new Map<string, number[]>();
  rows.filter((r) => r.metric === "LCP").forEach((r) => {
    const arr = byPage.get(r.page) ?? []; arr.push(r.value); byPage.set(r.page, arr);
  });
  const slowest = Array.from(byPage.entries())
    .map(([page, vs]) => { vs.sort((a, b) => a - b); return { page, p75: vs[Math.floor(0.75 * (vs.length - 1))], n: vs.length }; })
    .sort((a, b) => b.p75 - a.p75).slice(0, 10);

  const longTasks = rows.filter((r) => r.metric === "LongTask");

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6" /> مراقبة الأداء</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} قياس خلال آخر {days} يوم</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 px-3 rounded border bg-background text-sm">
          <option value={1}>اليوم</option><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يوم</option>
        </select>
      </header>

      {loading ? (
        <div className="text-muted-foreground">جاري التحميل...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cards.map((c) => {
              const ok = c.value !== null && c.value <= c.budget;
              return (
                <div key={c.label} className="bg-card border border-border rounded-lg p-4">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${ok ? "text-emerald-600" : "text-amber-600"}`}>
                    {c.value === null ? "—" : c.unit === "ms" ? Math.round(c.value) : c.value.toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground ms-1">{c.unit}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    الميزانية: {c.budget}{c.unit} · ضعيف: {c.poor}%
                  </div>
                </div>
              );
            })}
          </div>

          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Gauge className="h-4 w-4" /> أبطأ الصفحات (LCP p75)</h2>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground"><tr><th className="text-start py-1">الصفحة</th><th className="text-start py-1">LCP p75</th><th className="text-start py-1">عينات</th></tr></thead>
              <tbody>
                {slowest.map((r) => (
                  <tr key={r.page} className="border-t border-border">
                    <td className="py-1.5">{r.page}</td>
                    <td className={`py-1.5 ${r.p75 > PERF_BUDGETS.LCP_MS ? "text-amber-600 font-semibold" : ""}`}>{Math.round(r.p75)}ms</td>
                    <td className="py-1.5">{r.n}</td>
                  </tr>
                ))}
                {!slowest.length && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Long Tasks (تجمد محتمل)</h2>
            <p className="text-sm text-muted-foreground">عدد الأحداث: {longTasks.length} · أطول مدة: {longTasks.length ? Math.round(Math.max(...longTasks.map((l) => l.value))) : 0}ms</p>
          </section>

          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">توزيع الأجهزة</h2>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> {rows.filter((r) => r.device === "mobile").length}</div>
              <div className="flex items-center gap-2"><Monitor className="h-4 w-4" /> {rows.filter((r) => r.device === "desktop").length}</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
