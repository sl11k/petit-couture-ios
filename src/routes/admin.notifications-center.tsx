import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import {
  MessageCircle,
  Send,
  Zap,
  ClipboardList,
  BarChart3,
  Users,
  Megaphone,
  Bell,
  FileText,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  processQueueNow,
  checkProviderHealth,
} from "@/lib/notif/admin.functions";

export const Route = createFileRoute("/admin/notifications-center")({
  component: NotificationsCenter,
});

function NotificationsCenter() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const processFn = useServerFn(processQueueNow);
  const healthFn = useServerFn(checkProviderHealth);

  const load = async () => {
    const [{ data: q }, { data: logs }, { data: p }, { data: h }] = await Promise.all([
      supabase.from("notif_queue").select("status"),
      supabase
        .from("notif_delivery_logs")
        .select("status,created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ),
      supabase
        .from("notif_providers")
        .select("*")
        .eq("is_default", true)
        .maybeSingle(),
      supabase.from("notif_provider_health").select("*").limit(1).maybeSingle(),
    ]);
    setStats({
      queue: {
        pending: (q ?? []).filter((r: any) => r.status === "pending").length,
        retry: (q ?? []).filter((r: any) => r.status === "retry").length,
        failed: (q ?? []).filter((r: any) => r.status === "failed").length,
        sent: (q ?? []).filter((r: any) => r.status === "sent").length,
      },
      last24: {
        sent: (logs ?? []).filter((r: any) => r.status === "sent").length,
        failed: (logs ?? []).filter((r: any) => r.status === "failed").length,
      },
    });
    setProvider(p);
    setHealth(h);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runProcess = async () => {
    setBusy(true);
    try {
      const r = await processFn();
      toast.success(
        ar
          ? `تمت المعالجة: ${r.processed} — أُرسلت ${r.sent} — فشلت ${r.failed}`
          : `Processed ${r.processed} — sent ${r.sent} — failed ${r.failed}`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const runHealth = async () => {
    setBusy(true);
    try {
      const r: any = await healthFn();
      if (r?.ok) toast.success(ar ? "المزود متصل" : "Provider healthy");
      else toast.error(r?.error_message || (ar ? "المزود غير متاح" : "Provider unhealthy"));
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const cards: Array<{
    to: string;
    icon: any;
    title: { ar: string; en: string };
    desc: { ar: string; en: string };
  }> = [
    {
      to: "/admin/notif-wasender",
      icon: MessageCircle,
      title: { ar: "إعدادات WasenderAPI", en: "WasenderAPI Settings" },
      desc: {
        ar: "بيانات اعتماد المزود وحالة الاتصال",
        en: "Provider credentials & connection status",
      },
    },
    {
      to: "/admin/notif-events",
      icon: Zap,
      title: { ar: "أنواع الأحداث", en: "Event Types" },
      desc: { ar: "22 حدث نظامي", en: "22 system events" },
    },
    {
      to: "/admin/notif-templates",
      icon: FileText,
      title: { ar: "قوالب الرسائل", en: "Message Templates" },
      desc: { ar: "قوالب متعددة اللغات", en: "Multilingual templates" },
    },
    {
      to: "/admin/notif-queue",
      icon: ClipboardList,
      title: { ar: "قائمة الإرسال", en: "Queue" },
      desc: { ar: "الرسائل بانتظار الإرسال", en: "Pending messages" },
    },
    {
      to: "/admin/notif-logs",
      icon: Activity,
      title: { ar: "سجل الإرسال", en: "Delivery Logs" },
      desc: { ar: "كل محاولة إرسال", en: "Every delivery attempt" },
    },
    {
      to: "/admin/notif-analytics",
      icon: BarChart3,
      title: { ar: "الإحصائيات", en: "Analytics" },
      desc: { ar: "أعداد يومية", en: "Daily counts" },
    },
    {
      to: "/admin/notif-admins",
      icon: Users,
      title: { ar: "مستلمو الإدارة", en: "Admin Recipients" },
      desc: { ar: "أرقام تصلها إشعارات النظام", en: "Numbers receiving system alerts" },
    },
    {
      to: "/admin/notif-broadcast",
      icon: Megaphone,
      title: { ar: "الحملات الجماعية", en: "Broadcasts" },
      desc: { ar: "رسائل جماعية للعملاء", en: "Bulk campaigns" },
    },
    {
      to: "/admin/notif-providers",
      icon: Server,
      title: { ar: "المزودون", en: "Providers" },
      desc: { ar: "Wasender / Meta / Twilio", en: "Wasender / Meta / Twilio" },
    },
  ];

  return (
    <div>
      <PageHeader
        title={{ ar: "مركز الإشعارات", en: "Notifications Center" }}
        description={{
          ar: "بنية إشعارات متكاملة عبر واتساب/بريد/SMS مع قوائم انتظار وتحليلات",
          en: "Enterprise notification stack — WhatsApp/Email/SMS with queues & analytics",
        }}
        actions={
          <div className="flex gap-2">
            <button
              onClick={runProcess}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {ar ? "معالجة القائمة الآن" : "Process queue now"}
            </button>
            <button
              onClick={runHealth}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
            >
              <Activity className="h-3 w-3" />
              {ar ? "فحص الاتصال" : "Health check"}
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Provider status */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4 text-primary" />
              {ar ? "المزود الافتراضي" : "Default provider"}
            </div>
            {provider ? (
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Stat label={ar ? "المزود" : "Provider"} value={provider.name} />
                <Stat
                  label={ar ? "الحالة" : "Status"}
                  value={provider.is_enabled ? (ar ? "مفعّل" : "Enabled") : ar ? "معطّل" : "Disabled"}
                  ok={provider.is_enabled}
                />
                <Stat
                  label={ar ? "الاتصال" : "Health"}
                  value={health?.status ?? "—"}
                  ok={health?.status === "healthy"}
                />
                <Stat
                  label={ar ? "آخر فحص" : "Last check"}
                  value={
                    health?.checked_at
                      ? new Date(health.checked_at).toLocaleTimeString(ar ? "ar" : "en")
                      : "—"
                  }
                />
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {ar ? "لم يتم اختيار مزود افتراضي" : "No default provider selected"}
              </div>
            )}
          </div>

          {/* Queue + last 24h */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <MetricCard icon={ClipboardList} label={ar ? "بانتظار" : "Pending"} value={stats.queue.pending} tone="warn" />
            <MetricCard icon={ClipboardList} label={ar ? "إعادة" : "Retrying"} value={stats.queue.retry} tone="warn" />
            <MetricCard icon={XCircle} label={ar ? "فشلت" : "Failed"} value={stats.queue.failed} tone="danger" />
            <MetricCard icon={CheckCircle2} label={ar ? "أُرسلت" : "Sent"} value={stats.queue.sent} tone="ok" />
            <MetricCard icon={Send} label={ar ? "آخر 24س (نجح)" : "24h sent"} value={stats.last24.sent} tone="ok" />
            <MetricCard icon={Bell} label={ar ? "آخر 24س (فشل)" : "24h failed"} value={stats.last24.failed} tone="danger" />
          </div>

          {/* Section cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:bg-muted/50"
              >
                <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary/20">
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{ar ? c.title.ar : c.title.en}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {ar ? c.desc.ar : c.desc.en}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: any; ok?: boolean | null }) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1 text-sm font-medium">
        {ok === true && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
        {ok === false && <XCircle className="h-3.5 w-3.5 text-destructive" />}
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger";
}) {
  const toneCls =
    tone === "ok"
      ? "text-green-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-destructive";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-3 w-3 ${toneCls}`} /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
