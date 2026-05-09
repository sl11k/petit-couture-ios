import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Loader2, Activity, AlertCircle, Clock, Server } from "lucide-react";

export const Route = createFileRoute("/admin/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since24h = new Date(Date.now() - 86400000).toISOString();
      const [errors, criticals, webhooks, pendingDeliveries] = await Promise.all([
        supabase.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("error_logs").select("id", { count: "exact", head: true }).eq("severity", "critical").eq("resolved", false),
        supabase.from("webhook_events").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("webhook_deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "retrying"]),
      ]);
      setStats({
        errors24h: errors.count ?? 0,
        openCriticals: criticals.count ?? 0,
        webhooks24h: webhooks.count ?? 0,
        pendingDeliveries: pendingDeliveries.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const Card = ({ icon: Icon, label, value, danger }: any) => (
    <div className={`rounded-lg border p-4 ${danger && value > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`text-2xl font-semibold ${danger && value > 0 ? "text-destructive" : ""}`}>{value.toLocaleString(ar ? "ar" : "en")}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={{ ar: "الأداء", en: "Performance" }}
        description={{ ar: "صحة النظام خلال آخر 24 ساعة", en: "System health (last 24h)" }}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={AlertCircle} label={ar ? "أخطاء 24 ساعة" : "Errors (24h)"} value={stats.errors24h} />
        <Card icon={Activity} label={ar ? "أخطاء حرجة مفتوحة" : "Open critical errors"} value={stats.openCriticals} danger />
        <Card icon={Server} label={ar ? "أحداث Webhook" : "Webhook events"} value={stats.webhooks24h} />
        <Card icon={Clock} label={ar ? "تسليمات معلقة" : "Pending deliveries"} value={stats.pendingDeliveries} danger />
      </div>
    </div>
  );
}
