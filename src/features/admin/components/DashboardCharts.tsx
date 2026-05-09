import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type Range = 7 | 14 | 30 | 90;

type Point = { date: string; label: string; revenue: number; orders: number };

function buildBuckets(days: number): Point[] {
  const out: Point[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({
      date: iso,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      revenue: 0,
      orders: 0,
    });
  }
  return out;
}

export function DashboardCharts() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (range - 1));
      const { data: rows } = await supabase
        .from("orders")
        .select("created_at,total,status")
        .gte("created_at", since.toISOString())
        .neq("status", "cancelled")
        .limit(5000);

      if (cancelled) return;
      const buckets = buildBuckets(range);
      const idx = new Map(buckets.map((p, i) => [p.date, i]));
      for (const r of rows ?? []) {
        const day = new Date((r as any).created_at).toISOString().slice(0, 10);
        const i = idx.get(day);
        if (i === undefined) continue;
        buckets[i].orders += 1;
        buckets[i].revenue += Number((r as any).total ?? 0);
      }
      setData(buckets);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const totals = useMemo(() => {
    let rev = 0,
      ord = 0;
    for (const p of data) {
      rev += p.revenue;
      ord += p.orders;
    }
    return { rev, ord };
  }, [data]);

  const fmtMoney = (n: number) =>
    `${Number(n).toLocaleString(ar ? "ar" : "en", { maximumFractionDigits: 0 })} ${ar ? "ر.س" : "SAR"}`;

  const ranges: [Range, string][] = [
    [7, ar ? "7 أيام" : "7d"],
    [14, ar ? "14 يوم" : "14d"],
    [30, ar ? "30 يوم" : "30d"],
    [90, ar ? "90 يوم" : "90d"],
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">
            {ar ? "تطور الإيرادات والطلبات" : "Revenue & orders trend"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {ar
              ? `إجمالي ${range} يوم: ${fmtMoney(totals.rev)} • ${totals.ord.toLocaleString("ar")} طلب`
              : `Last ${range} days: ${fmtMoney(totals.rev)} • ${totals.ord.toLocaleString("en")} orders`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {ranges.map(([r, label]) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`h-8 rounded-md border px-2 text-xs transition-colors ${
                range === r
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-72 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              {ar ? "الإيرادات اليومية" : "Daily revenue"}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [fmtMoney(Number(v)), ar ? "الإيرادات" : "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              {ar ? "عدد الطلبات اليومية" : "Daily orders"}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [Number(v).toLocaleString(ar ? "ar" : "en"), ar ? "الطلبات" : "Orders"]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
