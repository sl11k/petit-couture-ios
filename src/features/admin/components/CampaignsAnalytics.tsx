import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, Send, Mail, MousePointerClick, ShoppingCart, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { format, subDays } from "date-fns";

type Range = "7d" | "30d" | "90d" | "custom";
type Ev = { campaign_id: string; event_type: string; revenue: number; created_at: string };
type Campaign = { id: string; name: string };

const days: Record<Exclude<Range, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };
const TYPES = ["sent", "open", "click", "conversion"] as const;
const COLORS: Record<string, string> = {
  sent: "hsl(var(--primary))", open: "#10b981", click: "#f59e0b", conversion: "#ef4444",
};

export function CampaignsAnalytics() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);

  const [range, setRange] = useState<Range>("30d");
  const [from, setFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [campaignId, setCampaignId] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  // sync preset → from/to
  useEffect(() => {
    if (range !== "custom") {
      setFrom(format(subDays(new Date(), days[range]), "yyyy-MM-dd"));
      setTo(format(new Date(), "yyyy-MM-dd"));
    }
  }, [range]);

  const load = async () => {
    setLoading(true);
    const start = new Date(from + "T00:00:00").toISOString();
    const end = new Date(to + "T23:59:59").toISOString();
    let q = supabase.from("campaign_events")
      .select("campaign_id, event_type, revenue, created_at")
      .gte("created_at", start).lte("created_at", end)
      .order("created_at", { ascending: true }).limit(50000);
    if (campaignId !== "all") q = q.eq("campaign_id", campaignId);
    const [evRes, cRes] = await Promise.all([
      q,
      supabase.from("marketing_campaigns").select("id, name").order("created_at", { ascending: false }).limit(500),
    ]);
    setEvents((evRes.data as Ev[]) || []);
    setCampaigns((cRes.data as Campaign[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, campaignId]);

  const totals = useMemo(() => {
    const r = { sent: 0, open: 0, click: 0, conversion: 0, revenue: 0 };
    for (const e of events) {
      if (e.event_type in r) (r as any)[e.event_type] += 1;
      if (e.event_type === "conversion") r.revenue += Number(e.revenue || 0);
    }
    return r;
  }, [events]);

  const series = useMemo(() => {
    const totalDays = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
    const bucketByDay = totalDays <= 60;
    const map = new Map<string, any>();
    for (const e of events) {
      const d = new Date(e.created_at);
      const key = bucketByDay
        ? format(d, "yyyy-MM-dd")
        : format(new Date(d.getFullYear(), d.getMonth(), Math.floor(d.getDate() / 7) * 7 + 1), "yyyy-MM-dd");
      const row = map.get(key) || { label: key, sent: 0, open: 0, click: 0, conversion: 0 };
      if (e.event_type in row) row[e.event_type] += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [events, from, to]);

  const openRate = totals.sent ? (totals.open / totals.sent) * 100 : 0;
  const ctr = totals.open ? (totals.click / totals.open) * 100 : 0;
  const cvr = totals.click ? (totals.conversion / totals.click) * 100 : 0;

  return (
    <div className="space-y-3 mb-4" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2">
        {(["7d", "30d", "90d", "custom"] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-md text-xs border ${range === r ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
            {r === "custom" ? t("مخصص", "Custom") : r}
          </button>
        ))}
        {range === "custom" && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-2 py-1.5 rounded-md border text-xs bg-background" />
            <span className="text-xs text-muted-foreground">→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-2 py-1.5 rounded-md border text-xs bg-background" />
          </>
        )}
        <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
          className="px-2 py-1.5 rounded-md border text-xs bg-background min-w-[180px]">
          <option value="all">{t("كل الحملات", "All campaigns")}</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={load} className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border bg-background hover:bg-muted">
          <RefreshCw className="size-3.5" /> {t("تحديث", "Refresh")}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Send className="size-4" />} label={t("الإرسال", "Sent")} value={totals.sent} />
        <Kpi icon={<Mail className="size-4 text-emerald-500" />} label={t("الفتح", "Opens")} value={totals.open} hint={`${openRate.toFixed(1)}% ${t("معدل فتح", "open rate")}`} />
        <Kpi icon={<MousePointerClick className="size-4 text-amber-500" />} label={t("الكليكات", "Clicks")} value={totals.click} hint={`${ctr.toFixed(1)}% CTR`} />
        <Kpi icon={<ShoppingCart className="size-4 text-rose-500" />} label={t("التحويلات", "Conversions")} value={totals.conversion}
          hint={`${cvr.toFixed(1)}% CVR · ${totals.revenue.toLocaleString(ar ? "ar" : "en")} ${t("ر.س", "SAR")}`} />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3">{t("النشاط عبر الزمن", "Activity over time")}</div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : series.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            {t("لا توجد أحداث في هذه الفترة", "No events in this period")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {TYPES.map(k => (
                <Line key={k} type="monotone" dataKey={k} stroke={COLORS[k]} strokeWidth={2} dot={false}
                  name={t(
                    k === "sent" ? "إرسال" : k === "open" ? "فتح" : k === "click" ? "كليك" : "تحويل",
                    k.charAt(0).toUpperCase() + k.slice(1),
                  )} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
