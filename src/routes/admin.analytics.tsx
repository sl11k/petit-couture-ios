import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

type Ev = {
  id: string;
  event_name: string;
  session_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type Order = { id: string; total: number; created_at: string };
type Cart = {
  id: string;
  email: string | null;
  session_id: string;
  subtotal: number;
  currency: string;
  updated_at: string;
};

const FUNNEL_STEPS = [
  { key: "page_view", labelAr: "زيارة الصفحة", labelEn: "Page View" },
  { key: "add_to_cart", labelAr: "إضافة للسلة", labelEn: "Add to Cart" },
  { key: "begin_checkout", labelAr: "بدء الدفع", labelEn: "Begin Checkout" },
  { key: "purchase", labelAr: "إتمام الشراء", labelEn: "Purchase" },
] as const;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function AnalyticsPage() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return startOfDay(d);
  });
  const [to, setTo] = useState<Date>(() => endOfDay(today));
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Ev[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const fromIso = startOfDay(from).toISOString();
      const toIso = endOfDay(to).toISOString();

      const [evRes, orderRes, cartRes] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("id, event_name, session_id, created_at, metadata")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(10000),
        supabase
          .from("orders")
          .select("id, total, created_at")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("abandoned_carts")
          .select("id, email, session_id, subtotal, currency, updated_at")
          .eq("converted", false)
          .gte("updated_at", fromIso)
          .lte("updated_at", toIso)
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      if (cancelled) return;
      setEvents((evRes.data ?? []) as Ev[]);
      setOrders((orderRes.data ?? []) as Order[]);
      setCarts((cartRes.data ?? []) as Cart[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  // Build funnel keyed on session_id: count of unique sessions that reached each step.
  // A session "reaches" a step if it has the event in the range.
  const funnel = useMemo(() => {
    const sessionsByStep: Record<string, Set<string>> = {};
    for (const step of FUNNEL_STEPS) sessionsByStep[step.key] = new Set();
    for (const ev of events) {
      if (sessionsByStep[ev.event_name]) {
        sessionsByStep[ev.event_name].add(ev.session_id);
      }
    }
    return FUNNEL_STEPS.map((step) => ({
      key: step.key,
      label: step.labelAr,
      sessions: sessionsByStep[step.key].size,
    }));
  }, [events]);

  const topSessions = funnel[0]?.sessions ?? 0;
  const purchases = funnel[funnel.length - 1]?.sessions ?? 0;
  const overallConversion = topSessions > 0 ? (purchases / topSessions) * 100 : 0;

  const totals = useMemo(() => {
    const pageViews = events.filter((e) => e.event_name === "page_view").length;
    const uniqueSessions = new Set(events.map((e) => e.session_id)).size;
    const revenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    return { pageViews, uniqueSessions, revenue };
  }, [events, orders]);

  // Daily series for bar chart
  const daily = useMemo(() => {
    const days: Record<string, { views: number; orders: number }> = {};
    const dayCount = Math.max(
      1,
      Math.ceil((endOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000),
    );
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startOfDay(from).getTime() + i * 86400000);
      days[d.toISOString().slice(0, 10)] = { views: 0, orders: 0 };
    }
    for (const e of events) {
      if (e.event_name !== "page_view") continue;
      const d = e.created_at.slice(0, 10);
      if (days[d]) days[d].views++;
    }
    for (const o of orders) {
      const d = o.created_at.slice(0, 10);
      if (days[d]) days[d].orders++;
    }
    return Object.entries(days)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v }));
  }, [events, orders, from, to]);

  const maxView = Math.max(1, ...daily.map((d) => d.views));

  const setPreset = (n: number) => {
    const t = endOfDay(new Date());
    const f = startOfDay(new Date());
    f.setDate(f.getDate() - (n - 1));
    setFrom(f);
    setTo(t);
  };

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">التحليلات</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <PresetBtn onClick={() => setPreset(1)}>اليوم</PresetBtn>
            <PresetBtn onClick={() => setPreset(7)}>7 أيام</PresetBtn>
            <PresetBtn onClick={() => setPreset(30)}>30 يوم</PresetBtn>
            <PresetBtn onClick={() => setPreset(90)}>90 يوم</PresetBtn>
          </div>
          <DateField label="من" value={from} onChange={(d) => d && setFrom(startOfDay(d))} />
          <DateField label="إلى" value={to} onChange={(d) => d && setTo(endOfDay(d))} />
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">جاري التحميل...</p>
      ) : (
        <>
          {/* Funnel */}
          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">القمع — حسب الجلسة</h2>
              <span className="text-xs text-muted-foreground">
                التحويل الكلي: <strong className="text-foreground">{overallConversion.toFixed(1)}%</strong>
              </span>
            </div>

            <div className="space-y-3">
              {funnel.map((step, idx) => {
                const widthPct = topSessions > 0 ? (step.sessions / topSessions) * 100 : 0;
                const prev = idx > 0 ? funnel[idx - 1].sessions : null;
                const stepConv = prev && prev > 0 ? (step.sessions / prev) * 100 : null;
                const dropOff = prev !== null ? prev - step.sessions : null;
                return (
                  <div key={step.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {idx + 1}. {step.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {step.sessions.toLocaleString()} جلسة
                        {stepConv !== null && (
                          <span className="ms-2 text-foreground/80">
                            ({stepConv.toFixed(1)}%)
                          </span>
                        )}
                        {dropOff !== null && dropOff > 0 && (
                          <span className="ms-2 text-destructive">
                            −{dropOff.toLocaleString()}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="relative h-7 overflow-hidden rounded-md bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-md transition-all",
                          idx === funnel.length - 1 ? "bg-primary" : "bg-primary/70",
                        )}
                        style={{ width: `${widthPct}%`, minWidth: step.sessions > 0 ? "2px" : "0" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Headline cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card label="الزيارات" value={totals.pageViews.toLocaleString()} />
            <Card label="جلسات فريدة" value={totals.uniqueSessions.toLocaleString()} />
            <Card label="مشتريات" value={purchases.toLocaleString()} accent />
            <Card label="الإيرادات" value={`${totals.revenue.toLocaleString()} SAR`} />
          </div>

          {/* Daily chart */}
          <div className="mt-8 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-base font-semibold">الزيارات اليومية</h2>
            <div className="flex h-40 items-end gap-1">
              {daily.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${(d.views / maxView) * 100}%`, minHeight: "2px" }}
                    title={`${d.views} زيارة، ${d.orders} طلب`}
                  />
                  <div className="text-[9px] text-muted-foreground">{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Abandoned carts */}
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-semibold">سلات مهجورة حديثة</h2>
            {carts.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {carts.slice(0, 10).map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between border-b border-border/50 pb-1 last:border-0"
                  >
                    <span className="text-xs">{c.email || c.session_id.slice(0, 12)}</span>
                    <span>
                      {Number(c.subtotal).toFixed(0)} {c.currency}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}

function PresetBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
    >
      {children}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 justify-start gap-2 text-left font-normal")}
        >
          <CalendarIcon className="h-4 w-4 opacity-60" />
          <span className="text-xs text-muted-foreground">{label}:</span>
          <span className="text-xs">{format(value, "yyyy-MM-dd")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
