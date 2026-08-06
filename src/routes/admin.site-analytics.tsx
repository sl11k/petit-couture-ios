import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Loader2, Eye, Search as SearchIcon, MousePointerClick, Link as LinkIcon, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/site-analytics")({
  component: SiteAnalyticsPage,
});

type Range = "7d" | "30d" | "90d";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

function SiteAnalyticsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>("7d");
  const [stats, setStats] = useState<any>(null);
  const [topQueries, setTopQueries] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topPages, setTopPages] = useState<{ path: string; count: number }[]>([]);
  const [topEvents, setTopEvents] = useState<{ name: string; count: number }[]>([]);
  const [dailyVisits, setDailyVisits] = useState<{ date: string; visits: number }[]>([]);
  const [topReferrers, setTopReferrers] = useState<{ source: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - RANGE_DAYS[range] * 86400000).toISOString();
      const hostDomain = window.location.hostname.replace("www.", "");
      
      const [rpcRes, productsRes] = await Promise.all([
        supabase.rpc("get_site_analytics_v1", { since, host_domain: hostDomain }),
        supabase.from("products").select("id, name_ar, name_en, views_count").order("views_count", { ascending: false }).limit(10),
      ]);

      const data = rpcRes.data as any || {};
      
      setStats({
        totalSearches: data.total_searches ?? 0,
        zeroResults: data.zero_results ?? 0,
        totalViews: (productsRes.data ?? []).reduce((s: number, p: any) => s + (p.views_count ?? 0), 0),
        uniqueSessions: data.unique_sessions ?? 0,
        referralClicks: data.referral_clicks ?? 0,
      });
      setTopQueries(data.top_queries ?? []);
      setTopProducts(productsRes.data ?? []);
      setTopPages(data.top_pages ?? []);
      setTopEvents(data.top_events ?? []);
      
      // Ensure daily visits dates are nicely formatted
      const daily = (data.daily_visits ?? []).sort((a: any, b: any) => a.date.localeCompare(b.date));
      setDailyVisits(daily);
      
      setTopReferrers(data.top_referrers ?? []);
      setLoading(false);
    })();
  }, [range]);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const Card = ({ icon: Icon, label, value }: any) => (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="text-2xl font-semibold">{value.toLocaleString(ar ? "ar" : "en")}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={{ ar: "تحليلات الموقع", en: "Site Analytics" }}
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
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card icon={Users} label={ar ? "إجمالي الزيارات" : "Total Visits"} value={stats.uniqueSessions} />
        <Card icon={LinkIcon} label={ar ? "زيارات من روابط" : "Referral Clicks"} value={stats.referralClicks} />
        <Card icon={SearchIcon} label={ar ? "عمليات البحث" : "Searches"} value={stats.totalSearches} />
        <Card icon={MousePointerClick} label={ar ? "بحث بدون نتائج" : "Zero results"} value={stats.zeroResults} />
        <Card icon={Eye} label={ar ? "مشاهدات المنتجات" : "Product views"} value={stats.totalViews} />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="mb-4 text-sm font-medium">{ar ? "الزيارات اليومية" : "Daily Visits"}</div>
        <div className="h-64 w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyVisits}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
              <XAxis dataKey="date" stroke="#888" tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#888" allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px", color: "#fff" }}
                itemStyle={{ color: "#fff" }}
              />
              <Bar dataKey="visits" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} name={ar ? "الزيارات" : "Visits"} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Row 1 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{ar ? "أهم مصادر الزيارات" : "Top Referral Sources"}</div>
          {topReferrers.length === 0 ? (
            <div className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ul className="space-y-1.5 h-[240px] overflow-y-auto pr-1">
              {topReferrers.map((r) => (
                <li key={r.source} className="flex items-center justify-between text-xs">
                  <span className="truncate" dir="ltr">{r.source}</span>
                  <span className="font-medium text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{ar ? "أكثر الصفحات زيارة" : "Top Pages"}</div>
          {topPages.length === 0 ? (
            <div className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ul className="space-y-1.5 h-[240px] overflow-y-auto pr-1">
              {topPages.map((p) => (
                <li key={p.path} className="flex items-center justify-between text-xs">
                  <span className="truncate" dir="ltr" title={p.path}>{p.path}</span>
                  <span className="font-medium text-muted-foreground">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{ar ? "توزيع الأحداث (Events)" : "Events Breakdown"}</div>
          {topEvents.length === 0 ? (
            <div className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ul className="space-y-1.5 h-[240px] overflow-y-auto pr-1">
              {topEvents.map((ev) => (
                <li key={ev.name} className="flex items-center justify-between text-xs">
                  <span className="truncate" dir="ltr">{ev.name}</span>
                  <span className="font-medium text-muted-foreground">{ev.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Row 2 */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{ar ? "أعلى الكلمات بحثاً" : "Top search queries"}</div>
          {topQueries.length === 0 ? (
            <div className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ul className="space-y-1.5 h-[240px] overflow-y-auto pr-1">
              {topQueries.map((r) => (
                <li key={r.q} className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.q}</span>
                  <span className="font-medium text-muted-foreground">{r.c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-medium">{ar ? "أكثر المنتجات مشاهدة" : "Most viewed products"}</div>
          {topProducts.length === 0 ? (
            <div className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ul className="space-y-1.5">
              {topProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{ar ? p.name_ar : p.name_en}</span>
                  <span className="font-medium text-muted-foreground">{p.views_count ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
