import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Loader2, Eye, Search as SearchIcon, MousePointerClick } from "lucide-react";

export const Route = createFileRoute("/admin/site-analytics")({
  component: SiteAnalyticsPage,
});

function SiteAnalyticsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [stats, setStats] = useState<any>(null);
  const [topQueries, setTopQueries] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const [searches, products] = await Promise.all([
        supabase.from("search_logs").select("query, results_count").gte("created_at", since).limit(1000),
        supabase.from("products").select("id, name_ar, name_en, views_count").order("views_count", { ascending: false }).limit(10),
      ]);

      const queryMap = new Map<string, number>();
      (searches.data ?? []).forEach((r: any) => {
        const q = (r.query ?? "").trim().toLowerCase();
        if (q) queryMap.set(q, (queryMap.get(q) ?? 0) + 1);
      });
      const top = [...queryMap.entries()].map(([q, c]) => ({ q, c })).sort((a, b) => b.c - a.c).slice(0, 10);

      setStats({
        totalSearches: searches.data?.length ?? 0,
        zeroResults: (searches.data ?? []).filter((r: any) => r.results_count === 0).length,
        totalViews: (products.data ?? []).reduce((s: number, p: any) => s + (p.views_count ?? 0), 0),
      });
      setTopQueries(top);
      setTopProducts(products.data ?? []);
      setLoading(false);
    })();
  }, []);

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
        description={{ ar: "آخر 7 أيام", en: "Last 7 days" }}
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card icon={SearchIcon} label={ar ? "عمليات البحث" : "Searches"} value={stats.totalSearches} />
        <Card icon={MousePointerClick} label={ar ? "بحث بدون نتائج" : "Zero results"} value={stats.zeroResults} />
        <Card icon={Eye} label={ar ? "مشاهدات المنتجات" : "Product views"} value={stats.totalViews} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{ar ? "أعلى الكلمات بحثاً" : "Top search queries"}</div>
          {topQueries.length === 0 ? (
            <div className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ul className="space-y-1.5">
              {topQueries.map((r) => (
                <li key={r.q} className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.q}</span>
                  <span className="font-medium text-muted-foreground">{r.c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
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
