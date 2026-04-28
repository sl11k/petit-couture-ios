import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart3, Calendar, Download, Mail, RefreshCw, TrendingUp, TrendingDown,
  ShoppingBag, Users, Package, CreditCard, Truck, Ticket, MousePointerClick,
  AlertTriangle, ShoppingCart, Plus, Trash2, Play,
} from "lucide-react";
import {
  getSalesSummary, getTimeSeries, getTopProducts, getInventoryHealth,
  getCustomersReport, getAbandonedReport, getIncompleteReport, getTrafficReport,
  getFunnelReport, getPaymentsReport, getShippingReport, getCouponsReport,
  downloadCSV, type DateRange,
} from "@/lib/reports";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage });

type TabKey =
  | "sales" | "trends" | "products" | "customers" | "abandoned"
  | "incomplete" | "traffic" | "funnel" | "payments" | "shipping"
  | "coupons" | "schedules";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "sales", label: "المبيعات العامة", icon: BarChart3 },
  { key: "trends", label: "الاتجاهات الزمنية", icon: TrendingUp },
  { key: "products", label: "المنتجات", icon: Package },
  { key: "customers", label: "العملاء", icon: Users },
  { key: "abandoned", label: "السلات المتروكة", icon: ShoppingCart },
  { key: "incomplete", label: "غير المكتملة", icon: AlertTriangle },
  { key: "traffic", label: "الزيارات", icon: MousePointerClick },
  { key: "funnel", label: "Funnel", icon: TrendingDown },
  { key: "payments", label: "الدفع", icon: CreditCard },
  { key: "shipping", label: "الشحن", icon: Truck },
  { key: "coupons", label: "الكوبونات", icon: Ticket },
  { key: "schedules", label: "الجدولة", icon: Mail },
];

const PRESETS = [
  { key: "today", label: "اليوم", days: 0 },
  { key: "7d", label: "7 أيام", days: 7 },
  { key: "30d", label: "30 يوم", days: 30 },
  { key: "90d", label: "90 يوم", days: 90 },
  { key: "365d", label: "سنة", days: 365 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
}
function money(n: number) {
  return `${fmt(n)} ر.س`;
}

function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("sales");
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0); return d;
  });
  const [to, setTo] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({});

  const range: DateRange = { from, to };

  function applyPreset(key: string) {
    setPreset(key);
    const days = PRESETS.find((p) => p.key === key)?.days ?? 30;
    const f = new Date(); f.setDate(f.getDate() - days); f.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(23, 59, 59, 999);
    setFrom(f); setTo(t);
  }

  async function load() {
    setLoading(true);
    try {
      if (tab === "sales") setData({ ...data, sales: await getSalesSummary(range) });
      else if (tab === "trends") {
        const [day, hour, weekday] = await Promise.all([
          getTimeSeries(range, "day"), getTimeSeries(range, "hour"), getTimeSeries(range, "weekday"),
        ]);
        setData({ ...data, trends: { day, hour, weekday } });
      } else if (tab === "products") {
        const [top, inv] = await Promise.all([getTopProducts(range, 30), getInventoryHealth()]);
        setData({ ...data, products: { top, inv } });
      } else if (tab === "customers") setData({ ...data, customers: await getCustomersReport(range) });
      else if (tab === "abandoned") setData({ ...data, abandoned: await getAbandonedReport(range) });
      else if (tab === "incomplete") setData({ ...data, incomplete: await getIncompleteReport(range) });
      else if (tab === "traffic") setData({ ...data, traffic: await getTrafficReport(range) });
      else if (tab === "funnel") setData({ ...data, funnel: await getFunnelReport(range) });
      else if (tab === "payments") setData({ ...data, payments: await getPaymentsReport(range) });
      else if (tab === "shipping") setData({ ...data, shipping: await getShippingReport(range) });
      else if (tab === "coupons") setData({ ...data, coupons: await getCouponsReport(range) });
      else if (tab === "schedules") {
        const { data: schedules } = await supabase.from("report_schedules").select("*").order("created_at", { ascending: false });
        const { data: runs } = await supabase.from("report_runs").select("*").order("created_at", { ascending: false }).limit(50);
        setData({ ...data, schedules: { schedules: schedules ?? [], runs: runs ?? [] } });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ في تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, from, to]);

  return (
    <AdminShell>
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">التقارير الشاملة</h1>
            <p className="text-sm text-muted-foreground">قرارات مبنية على بيانات حقيقية</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => applyPreset(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${preset === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={from.toISOString().slice(0, 10)}
                onChange={(e) => { setPreset(""); setFrom(new Date(e.target.value)); }}
                className="bg-transparent text-xs outline-none" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={to.toISOString().slice(0, 10)}
                onChange={(e) => { setPreset(""); const d = new Date(e.target.value); d.setHours(23,59,59,999); setTo(d); }}
                className="bg-transparent text-xs outline-none" />
            </div>
            <button onClick={load} className="rounded-md border border-border bg-card p-2 hover:bg-muted">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </nav>

        <section className="space-y-4">
          {loading && <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>}

          {!loading && tab === "sales" && data.sales && <SalesView s={data.sales} />}
          {!loading && tab === "trends" && data.trends && <TrendsView t={data.trends} />}
          {!loading && tab === "products" && data.products && <ProductsView p={data.products} />}
          {!loading && tab === "customers" && data.customers && <CustomersView c={data.customers} />}
          {!loading && tab === "abandoned" && data.abandoned && <AbandonedView a={data.abandoned} />}
          {!loading && tab === "incomplete" && data.incomplete && <IncompleteView i={data.incomplete} />}
          {!loading && tab === "traffic" && data.traffic && <TrafficView t={data.traffic} />}
          {!loading && tab === "funnel" && data.funnel && <FunnelView f={data.funnel} />}
          {!loading && tab === "payments" && data.payments && <PaymentsView p={data.payments} />}
          {!loading && tab === "shipping" && data.shipping && <ShippingView s={data.shipping} />}
          {!loading && tab === "coupons" && data.coupons && <CouponsView c={data.coupons} />}
          {!loading && tab === "schedules" && data.schedules && <SchedulesView d={data.schedules} reload={load} />}
        </section>
      </div>
    </AdminShell>
  );
}

// ---------- Sub views ----------
function Stat({ label, value, sub, trend }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      {trend !== undefined && (
        <p className={`mt-1 text-[11px] font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {trend >= 0 ? "▲" : "▼"} {fmt(Math.abs(trend))}% مقارنة بالفترة السابقة
        </p>
      )}
    </div>
  );
}

function SalesView({ s }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="إجمالي المبيعات" value={money(s.gross_sales)} trend={s.growth_pct} />
        <Stat label="صافي المبيعات" value={money(s.net_sales)} sub="بعد الاستردادات" />
        <Stat label="عدد الطلبات" value={fmt(s.orders_count)} sub={`السابق: ${fmt(s.prev_orders_count)}`} />
        <Stat label="متوسط قيمة الطلب" value={money(s.aov)} />
        <Stat label="المنتجات المباعة" value={fmt(s.items_sold)} />
        <Stat label="الخصومات" value={money(s.discounts)} />
        <Stat label="الضرائب" value={money(s.tax)} />
        <Stat label="رسوم الشحن" value={money(s.shipping)} />
        <Stat label="الاستردادات" value={money(s.refunds)} />
        <Stat label="عدد المرتجعات" value={fmt(s.returns_count)} />
      </div>
      <button onClick={() => downloadCSV("sales-summary.csv", [s])}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
        <Download className="h-3.5 w-3.5" />تصدير CSV
      </button>
    </>
  );
}

function BarRow({ label, value, max }: any) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-left tabular-nums text-foreground">{fmt(value)}</span>
    </div>
  );
}

function TrendsView({ t }: any) {
  const dayMax = Math.max(1, ...t.day.map((d: any) => d.revenue));
  const hourMax = Math.max(1, ...t.hour.map((d: any) => d.orders));
  const wkMax = Math.max(1, ...t.weekday.map((d: any) => d.orders));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="المبيعات اليومية" action={<ExportBtn name="daily.csv" rows={t.day} />}>
        <div className="space-y-1">
          {t.day.slice(-30).map((d: any) => <BarRow key={d.bucket} label={d.bucket} value={d.revenue} max={dayMax} />)}
        </div>
      </Card>
      <Card title="أكثر ساعات الطلب" action={<ExportBtn name="hours.csv" rows={t.hour} />}>
        <div className="space-y-1">
          {t.hour.map((d: any) => <BarRow key={d.bucket} label={d.bucket} value={d.orders} max={hourMax} />)}
        </div>
      </Card>
      <Card title="أكثر أيام الطلب" action={<ExportBtn name="weekdays.csv" rows={t.weekday} />}>
        <div className="space-y-1">
          {t.weekday.map((d: any) => <BarRow key={d.bucket} label={d.bucket} value={d.orders} max={wkMax} />)}
        </div>
      </Card>
    </div>
  );
}

function ProductsView({ p }: any) {
  return (
    <div className="space-y-4">
      <Card title="الأكثر مبيعًا" action={<ExportBtn name="top-products.csv" rows={p.top} />}>
        <Table cols={["المنتج", "الكمية", "الإيرادات"]}
          rows={p.top.map((r: any) => [r.name, fmt(r.qty), money(r.revenue)])} />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`نفدت من المخزون (${p.inv.out_of_stock.length})`}>
          <Table cols={["المنتج", "السعر"]}
            rows={p.inv.out_of_stock.map((r: any) => [r.name_ar, money(Number(r.price))])} />
        </Card>
        <Card title={`مخزون منخفض (${p.inv.low_stock.length})`}>
          <Table cols={["المنتج", "المخزون"]}
            rows={p.inv.low_stock.map((r: any) => [r.name_ar, r.stock])} />
        </Card>
      </div>
    </div>
  );
}

function CustomersView({ c }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="عملاء جدد" value={fmt(c.new_count)} />
        <Stat label="عملاء متكررون" value={fmt(c.returning_count)} />
        <Stat label="معدل تكرار الشراء" value={`${fmt(c.repeat_rate)}%`} />
        <Stat label="متوسط LTV" value={money(c.ltv_avg)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="أفضل العملاء" action={<ExportBtn name="top-customers.csv" rows={c.top} />}>
          <Table cols={["العميل", "الطلبات", "الإجمالي"]}
            rows={c.top.map((r: any) => [r.name || r.email, r.orders, money(r.spent)])} />
        </Card>
        <Card title="عملاء غير نشطين (>90 يوم)" action={<ExportBtn name="inactive.csv" rows={c.inactive} />}>
          <Table cols={["العميل", "آخر طلب", "إجمالي"]}
            rows={c.inactive.map((r: any) => [r.name || r.email, r.last_order_at?.slice(0,10), money(r.spent)])} />
        </Card>
        <Card title="المدن الأعلى شراءً" action={<ExportBtn name="cities.csv" rows={c.cities} />}>
          <Table cols={["المدينة", "الطلبات", "الإيرادات"]}
            rows={c.cities.map((r: any) => [r.city, r.orders, money(r.revenue)])} />
        </Card>
      </div>
    </div>
  );
}

function AbandonedView({ a }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="عدد السلات" value={fmt(a.count)} />
        <Stat label="قيمة السلات" value={money(a.total_value)} />
        <Stat label="معدل الاستعادة" value={`${fmt(a.recovery_rate)}%`} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="مرحلة الترك"><Table cols={["المرحلة", "العدد"]} rows={a.stages.map((r:any)=>[r.stage, r.count])} /></Card>
        <Card title="الأسباب"><Table cols={["السبب", "العدد"]} rows={a.reasons.map((r:any)=>[r.reason, r.count])} /></Card>
        <Card title="منتجات متروكة" action={<ExportBtn name="abandoned-products.csv" rows={a.top_products} />}>
          <Table cols={["المنتج", "الكمية"]} rows={a.top_products.map((r:any)=>[r.name, r.qty])} />
        </Card>
      </div>
    </div>
  );
}

function IncompleteView({ i }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="عدد الطلبات" value={fmt(i.total_count)} />
        <Stat label="قيمة الفرص الضائعة" value={money(i.lost_value)} />
      </div>
      <Card title="حسب الحالة" action={<ExportBtn name="incomplete.csv" rows={i.by_status} />}>
        <Table cols={["الحالة", "العدد", "القيمة"]}
          rows={i.by_status.map((r: any) => [r.status, r.count, money(r.value)])} />
      </Card>
    </div>
  );
}

function TrafficView({ t }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="عدد الزيارات" value={fmt(t.visits)} />
        <Stat label="زوار فريدون" value={fmt(t.unique_visitors)} />
        <Stat label="معدل الارتداد" value={`${fmt(t.bounce_rate)}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="مصادر الزيارات" action={<ExportBtn name="sources.csv" rows={t.sources} />}>
          <Table cols={["المصدر", "الزيارات"]} rows={t.sources.map((r:any)=>[r.source, r.count])} />
        </Card>
        <Card title="الصفحات الأكثر زيارة" action={<ExportBtn name="pages.csv" rows={t.top_pages} />}>
          <Table cols={["الصفحة", "المشاهدات"]} rows={t.top_pages.map((r:any)=>[r.path, r.views])} />
        </Card>
      </div>
    </div>
  );
}

function FunnelView({ f }: any) {
  const max = Math.max(1, ...f.map((s: any) => s.count));
  return (
    <Card title="مسار التحويل (Funnel)" action={<ExportBtn name="funnel.csv" rows={f} />}>
      <div className="space-y-3">
        {f.map((s: any, idx: number) => (
          <div key={s.step}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{idx + 1}. {s.step}</span>
              <span className="tabular-nums text-muted-foreground">
                {fmt(s.count)} · {fmt(s.pct_total)}% من الإجمالي
                {idx > 0 && <span className="ms-2 text-red-600">▼ {fmt(s.drop_off)}%</span>}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PaymentsView({ p }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ناجحة" value={fmt(p.success)} />
        <Stat label="فاشلة" value={fmt(p.failed)} />
        <Stat label="قيد المعالجة" value={fmt(p.pending)} />
        <Stat label="مستردة" value={fmt(p.refunded)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="طرق الدفع" action={<ExportBtn name="methods.csv" rows={p.methods} />}>
          <Table cols={["الطريقة", "العدد", "المبلغ"]}
            rows={p.methods.map((r: any) => [r.method, r.count, money(r.amount)])} />
        </Card>
        <Card title="فشل البوابات" action={<ExportBtn name="gateways.csv" rows={p.gateway_failure} />}>
          <Table cols={["البوابة", "نجاح", "فشل", "نسبة الفشل"]}
            rows={p.gateway_failure.map((r: any) => [r.gateway, r.success, r.failed, `${fmt(r.failure_rate)}%`])} />
        </Card>
      </div>
    </div>
  );
}

function ShippingView({ s }: any) {
  return (
    <div className="space-y-4">
      <Stat label="إجمالي تكلفة الشحن" value={money(s.total_cost)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="حسب شركة الشحن" action={<ExportBtn name="carriers.csv" rows={s.carriers} />}>
          <Table cols={["الشركة", "الشحنات", "تم التسليم", "فشل", "التكلفة"]}
            rows={s.carriers.map((r: any) => [r.carrier, r.count, r.delivered, r.failed, money(r.cost)])} />
        </Card>
        <Card title="مدن ذات مشاكل" action={<ExportBtn name="problem-cities.csv" rows={s.problem_cities} />}>
          <Table cols={["المدينة", "المشاكل"]} rows={s.problem_cities.map((r: any) => [r.city, r.issues])} />
        </Card>
      </div>
    </div>
  );
}

function CouponsView({ c }: any) {
  return (
    <Card title="أكثر الكوبونات استخدامًا" action={<ExportBtn name="coupons.csv" rows={c.top} />}>
      <Table cols={["الكود", "مرات الاستخدام", "الخصم"]}
        rows={c.top.map((r: any) => [r.code, r.uses, r.discount])} />
    </Card>
  );
}

function SchedulesView({ d, reload }: { d: any; reload: () => void }) {
  const [name, setName] = useState("");
  const [reportKey, setReportKey] = useState<TabKey>("sales");
  const [frequency, setFrequency] = useState("daily");
  const [recipients, setRecipients] = useState("");

  async function add() {
    if (!name || !recipients) { toast.error("أدخل الاسم والمستلمين"); return; }
    const emails = recipients.split(/[,;\s]+/).filter(Boolean);
    const next = new Date();
    if (frequency === "daily") next.setDate(next.getDate() + 1);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    const { error } = await supabase.from("report_schedules").insert({
      name, report_key: reportKey, frequency, recipients: emails, next_run_at: next.toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تمت الجدولة");
    setName(""); setRecipients("");
    reload();
  }

  async function toggle(id: string, val: boolean) {
    await supabase.from("report_schedules").update({ is_enabled: val }).eq("id", id);
    reload();
  }
  async function remove(id: string) {
    await supabase.from("report_schedules").delete().eq("id", id);
    reload();
  }
  async function runNow(s: any) {
    const { error } = await supabase.from("report_runs").insert({
      schedule_id: s.id, report_key: s.report_key, status: "success",
      recipients: s.recipients, rows_count: 0,
    });
    if (error) toast.error(error.message);
    else { toast.success("تم تنفيذ التقرير وتسجيله"); reload(); }
  }

  return (
    <div className="space-y-4">
      <Card title="جدولة جديدة">
        <div className="grid gap-3 md:grid-cols-5">
          <input className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="الاسم"
            value={name} onChange={(e) => setName(e.target.value)} />
          <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={reportKey} onChange={(e) => setReportKey(e.target.value as TabKey)}>
            {TABS.filter((t) => t.key !== "schedules").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="daily">يومي</option>
            <option value="weekly">أسبوعي</option>
            <option value="monthly">شهري</option>
          </select>
          <input className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="emails مفصولة بفواصل"
            value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          <button onClick={add} className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            <Plus className="h-4 w-4" />إضافة
          </button>
        </div>
      </Card>

      <Card title={`الجدولات (${d.schedules.length})`}>
        <Table cols={["الاسم", "التقرير", "التكرار", "المستلمون", "الحالة", "إجراءات"]}
          rows={d.schedules.map((s: any) => [
            s.name,
            TABS.find((t) => t.key === s.report_key)?.label ?? s.report_key,
            s.frequency,
            (s.recipients as string[]).join(", "),
            <button key="t" onClick={() => toggle(s.id, !s.is_enabled)}
              className={`rounded-full px-2 py-0.5 text-[10px] ${s.is_enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {s.is_enabled ? "مفعّل" : "معطّل"}
            </button>,
            <div key="a" className="flex gap-1">
              <button onClick={() => runNow(s)} className="rounded p-1 hover:bg-muted" title="تنفيذ الآن"><Play className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(s.id)} className="rounded p-1 text-red-600 hover:bg-muted" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>,
          ])} />
      </Card>

      <Card title="سجل التشغيل">
        <Table cols={["التاريخ", "التقرير", "الحالة", "المستلمون"]}
          rows={d.runs.map((r: any) => [
            new Date(r.created_at).toLocaleString("ar-SA"),
            TABS.find((t) => t.key === r.report_key)?.label ?? r.report_key,
            r.status,
            (r.recipients as string[]).join(", "),
          ])} />
      </Card>
    </div>
  );
}

// ---------- shared bits ----------
function Card({ title, action, children }: any) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: any[][] }) {
  if (!rows.length) return <p className="py-4 text-center text-xs text-muted-foreground">لا توجد بيانات</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border text-muted-foreground">
          {cols.map((c) => <th key={c} className="px-2 py-2 text-right font-medium">{c}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {r.map((cell, j) => <td key={j} className="px-2 py-1.5 text-foreground">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportBtn({ name, rows }: { name: string; rows: any[] }) {
  return (
    <button onClick={() => downloadCSV(name, rows)}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">
      <Download className="h-3 w-3" />CSV
    </button>
  );
}
