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
      const [searches, products, events] = await Promise.all([
        supabase.from("search_logs").select("query, results_count").gte("created_at", since).limit(1000),
        supabase.from("products").select("id, name_ar, name_en, views_count").order("views_count", { ascending: false }).limit(10),
        supabase.from("analytics_events").select("session_id, created_at, referrer, event_name, path").gte("created_at", since),
      ]);

      const queryMap = new Map<string, number>();
      (searches.data ?? []).forEach((r: any) => {
        const q = (r.query ?? "").trim().toLowerCase();
        if (q) queryMap.set(q, (queryMap.get(q) ?? 0) + 1);
      });
      const top = [...queryMap.entries()].map(([q, c]) => ({ q, c })).sort((a, b) => b.c - a.c).slice(0, 10);

      const visitsMap = new Map<string, Set<string>>();
      const refMap = new Map<string, number>();
      const pathMap = new Map<string, number>();
      const eventMap = new Map<string, number>();

      const EXCLUDED_DOMAINS = ["lovable.dev", "lovableproject.com", "lovable.app"];

      (events.data ?? []).forEach((ev: any) => {
        // Collect detailed event stats
        if (ev.event_name) {
          eventMap.set(ev.event_name, (eventMap.get(ev.event_name) ?? 0) + 1);
        }
        
        // Exclude specific lovable referrers completely from counts if they are the source
        // Wait, if we want to exclude visits ENTIRELY from these referrers:
        let r = ev.referrer ?? "";
        try { r = new URL(r).hostname.replace("www.", ""); } catch(e) {}
        
        if (EXCLUDED_DOMAINS.some((d) => r.endsWith(d))) {
          return; // Skip this event completely from the dashboard
        }

        const day = ev.created_at.slice(0, 10);
        if (!visitsMap.has(day)) visitsMap.set(day, new Set());
        visitsMap.get(day)!.add(ev.session_id);

        if (ev.path) {
          pathMap.set(ev.path, (pathMap.get(ev.path) ?? 0) + 1);
        }

        if (r && r !== window.location.hostname) {
          refMap.set(r, (refMap.get(r) ?? 0) + 1);
        }
      });

      const daily = Array.from(visitsMap.entries())
        .map(([date, set]) => ({ date, visits: set.size }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const referrersList = Array.from(refMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const topPagesList = Array.from(pathMap.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const topEventsList = Array.from(eventMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const uniqueSessions = Array.from(visitsMap.values()).reduce((sum, s) => sum + s.size, 0); // Or track globally
      // Actually global unique over the range is:
      const allSessions = new Set();
      (events.data ?? []).forEach((ev: any) => {
        let r = ev.referrer ?? "";
        try { r = new URL(r).hostname.replace("www.", ""); } catch(e) {}
        if (!EXCLUDED_DOMAINS.some((d) => r.endsWith(d))) {
          allSessions.add(ev.session_id);
        }
      });
      const globalUniqueSessions = allSessions.size;

      const referralClicks = Array.from(refMap.values()).reduce((a, b) => a + b, 0);

      setStats({
        totalSearches: searches.data?.length ?? 0,
        zeroResults: (searches.data ?? []).filter((r: any) => r.results_count === 0).length,
        totalViews: (products.data ?? []).reduce((s: number, p: any) => s + (p.views_count ?? 0), 0),
        uniqueSessions: globalUniqueSessions,
        referralClicks,
      });
      setTopQueries(top);
      setTopProducts(products.data ?? []);
      setTopPages(topPagesList);
      setTopEvents(topEventsList);
      setDailyVisits(daily);
      setTopReferrers(referrersList);
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
