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

type Row = { label: string; value: number; sub?: string };

function flag(code: string) {
  if (!code || code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

function SiteAnalyticsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [range, setRange] = useState<Range>("7d");
  const [stats, setStats] = useState<any>(null);
  const [topQueries, setTopQueries] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topPages, setTopPages] = useState<any[]>([]);
  const [topEvents, setTopEvents] = useState<any[]>([]);
  const [dailyVisits, setDailyVisits] = useState<{ date: string; visits: number; pageviews: number }[]>([]);
  const [topReferrers, setTopReferrers] = useState<{ source: string; count: number }[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [devices, setDevices] = useState<{ device: string; count: number }[]>([]);
  const [browsers, setBrowsers] = useState<any[]>([]);
  const [oses, setOses] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);
  const [entryPages, setEntryPages] = useState<any[]>([]);
  const [exitPages, setExitPages] = useState<any[]>([]);
  const [utmSources, setUtmSources] = useState<any[]>([]);
  const [utmMediums, setUtmMediums] = useState<any[]>([]);
  const [utmCampaigns, setUtmCampaigns] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - RANGE_DAYS[range] * 86400000).toISOString();
      const hostDomain = window.location.hostname.replace("www.", "");
      
      const [rpcRes] = await Promise.all([
        supabase.rpc("get_site_analytics_v1", { since, host_domain: hostDomain }),
      ]);

      const data = rpcRes.data as any || {};

      setStats({
        totalSearches: data.total_searches ?? 0,
        zeroResults: data.zero_results ?? 0,
        totalViews: data.total_product_views ?? 0,
        uniqueSessions: data.unique_sessions ?? 0,
        uniqueVisitors: data.unique_visitors ?? 0,
        pageviews: data.total_pageviews ?? 0,
        viewsPerVisit: Number(data.views_per_visit ?? 0),
        avgDuration: Number(data.avg_duration_sec ?? 0),
        bounceRate: Number(data.bounce_rate ?? 0),
        directVisits: data.direct_visits ?? 0,
        referralClicks: data.referral_clicks ?? 0,
      });
      setDevices(data.devices ?? []);
      setBrowsers(data.browsers ?? []);
      setOses(data.operating_systems ?? []);
      setCountries(data.countries ?? []);
      setLanguages(data.languages ?? []);
      setEntryPages(data.entry_pages ?? []);
      setExitPages(data.exit_pages ?? []);
      setUtmSources(data.utm_sources ?? []);
      setUtmMediums(data.utm_mediums ?? []);
      setUtmCampaigns(data.utm_campaigns ?? []);
      setSources(data.sources ?? []);
      setFunnel(data.funnel ?? null);
      setTopQueries(data.top_queries ?? []);
      setTopProducts(data.top_products ?? []);
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
      <div className="text-2xl font-semibold">
        {typeof value === "number" ? value.toLocaleString(ar ? "ar" : "en") : value}
      </div>
    </div>
  );

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}m ${sec}s`;
  };
  const deviceTotal = devices.reduce((sum, d) => sum + Number(d.count || 0), 0) || 1;
  const deviceLabel: Record<string, { ar: string; en: string }> = {
    mobile: { ar: "جوال", en: "Mobile" },
    desktop: { ar: "كمبيوتر", en: "Desktop" },
    tablet: { ar: "تابلت", en: "Tablet" },
    unknown: { ar: "غير معروف", en: "Unknown" },
  };

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
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card icon={Users} label={ar ? "الزيارات" : "Visits"} value={stats.uniqueSessions} />
        <Card icon={Users} label={ar ? "زوار فريدون" : "Unique visitors"} value={stats.uniqueVisitors} />
        <Card icon={Eye} label={ar ? "مشاهدات الصفحات" : "Page views"} value={stats.pageviews} />
        <Card icon={Eye} label={ar ? "مشاهدات لكل زيارة" : "Views / visit"} value={stats.viewsPerVisit} />
        <Card icon={MousePointerClick} label={ar ? "مدة الزيارة" : "Visit duration"} value={fmtDuration(stats.avgDuration)} />
        <Card icon={MousePointerClick} label={ar ? "معدل الارتداد" : "Bounce rate"} value={`${stats.bounceRate}%`} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card icon={LinkIcon} label={ar ? "زيارات من روابط" : "Referral visits"} value={stats.referralClicks} />
        <Card icon={LinkIcon} label={ar ? "زيارات مباشرة" : "Direct visits"} value={stats.directVisits} />
        <Card icon={SearchIcon} label={ar ? "عمليات البحث" : "Searches"} value={stats.totalSearches} />
        <Card icon={MousePointerClick} label={ar ? "بحث بدون نتائج" : "Zero results"} value={stats.zeroResults} />
        <Card icon={Eye} label={ar ? "مشاهدات المنتجات" : "Product views"} value={stats.totalViews} />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 text-sm font-medium">{ar ? "الأجهزة" : "Devices"}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {devices.map((d) => (
            <div key={d.device} className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">{deviceLabel[d.device]?.[ar ? "ar" : "en"] ?? d.device}</div>
              <div className="text-lg font-semibold">{((Number(d.count) / deviceTotal) * 100).toFixed(1)}%</div>
              <div className="text-[11px] text-muted-foreground">{Number(d.count).toLocaleString(ar ? "ar" : "en")}</div>
            </div>
          ))}
        </div>
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
