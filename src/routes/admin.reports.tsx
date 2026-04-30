import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTr } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  BarChart3, Calendar, Download, Mail, RefreshCw, TrendingUp, TrendingDown,
  Users, Package, CreditCard, Truck, Ticket, MousePointerClick,
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

function ReportsPage() {
  const tr = useTr();
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const fmt = (n: number) =>
    new Intl.NumberFormat(isAr ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(n);
  const money = (n: number) => `${fmt(n)} ${isAr ? "ر.س" : "SAR"}`;

  const TABS: { key: TabKey; label: string; icon: any }[] = useMemo(() => ([
    { key: "sales", label: tr("المبيعات العامة", "General Sales"), icon: BarChart3 },
    { key: "trends", label: tr("الاتجاهات الزمنية", "Time Trends"), icon: TrendingUp },
    { key: "products", label: tr("المنتجات", "Products"), icon: Package },
    { key: "customers", label: tr("العملاء", "Customers"), icon: Users },
    { key: "abandoned", label: tr("السلات المتروكة", "Abandoned Carts"), icon: ShoppingCart },
    { key: "incomplete", label: tr("غير المكتملة", "Incomplete"), icon: AlertTriangle },
    { key: "traffic", label: tr("الزيارات", "Traffic"), icon: MousePointerClick },
    { key: "funnel", label: "Funnel", icon: TrendingDown },
    { key: "payments", label: tr("الدفع", "Payments"), icon: CreditCard },
    { key: "shipping", label: tr("الشحن", "Shipping"), icon: Truck },
    { key: "coupons", label: tr("الكوبونات", "Coupons"), icon: Ticket },
    { key: "schedules", label: tr("الجدولة", "Schedules"), icon: Mail },
  ]), [tr]);

  const PRESETS = useMemo(() => ([
    { key: "today", label: tr("اليوم", "Today"), days: 0 },
    { key: "7d", label: tr("7 أيام", "7 days"), days: 7 },
    { key: "30d", label: tr("30 يوم", "30 days"), days: 30 },
    { key: "90d", label: tr("90 يوم", "90 days"), days: 90 },
    { key: "365d", label: tr("سنة", "Year"), days: 365 },
  ]), [tr]);

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
      toast.error(e?.message ?? tr("خطأ في تحميل التقرير", "Error loading report"));
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
            <h1 className="text-2xl font-bold text-foreground">{tr("التقارير الشاملة", "Comprehensive Reports")}</h1>
            <p className="text-sm text-muted-foreground">{tr("قرارات مبنية على بيانات حقيقية", "Decisions based on real data")}</p>
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
          {loading && <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">{tr("جاري التحميل...", "Loading...")}</div>}

          {!loading && tab === "sales" && data.sales && <SalesView s={data.sales} tr={tr} fmt={fmt} money={money} />}
          {!loading && tab === "trends" && data.trends && <TrendsView t={data.trends} tr={tr} fmt={fmt} />}
          {!loading && tab === "products" && data.products && <ProductsView p={data.products} tr={tr} fmt={fmt} money={money} />}
          {!loading && tab === "customers" && data.customers && <CustomersView c={data.customers} tr={tr} fmt={fmt} money={money} />}
          {!loading && tab === "abandoned" && data.abandoned && <AbandonedView a={data.abandoned} tr={tr} fmt={fmt} money={money} />}
          {!loading && tab === "incomplete" && data.incomplete && <IncompleteView i={data.incomplete} tr={tr} fmt={fmt} money={money} />}
          {!loading && tab === "traffic" && data.traffic && <TrafficView t={data.traffic} tr={tr} fmt={fmt} />}
          {!loading && tab === "funnel" && data.funnel && <FunnelView f={data.funnel} tr={tr} fmt={fmt} />}
          {!loading && tab === "payments" && data.payments && <PaymentsView p={data.payments} tr={tr} fmt={fmt} money={money} />}
          {!loading && tab === "shipping" && data.shipping && <ShippingView s={data.shipping} tr={tr} money={money} />}
          {!loading && tab === "coupons" && data.coupons && <CouponsView c={data.coupons} tr={tr} />}
          {!loading && tab === "schedules" && data.schedules && <SchedulesView d={data.schedules} reload={load} tr={tr} TABS={TABS} isAr={isAr} />}
        </section>
      </div>
    </AdminShell>
  );
}

// ---------- Sub views ----------
function Stat({ label, value, sub, trend, tr, fmt }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      {trend !== undefined && (
        <p className={`mt-1 text-[11px] font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {trend >= 0 ? "▲" : "▼"} {fmt(Math.abs(trend))}% {tr("مقارنة بالفترة السابقة", "vs previous period")}
        </p>
      )}
    </div>
  );
}

function SalesView({ s, tr, fmt, money }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("إجمالي المبيعات", "Gross sales")} value={money(s.gross_sales)} trend={s.growth_pct} tr={tr} fmt={fmt} />
        <Stat label={tr("صافي المبيعات", "Net sales")} value={money(s.net_sales)} sub={tr("بعد الاستردادات", "After refunds")} tr={tr} fmt={fmt} />
        <Stat label={tr("عدد الطلبات", "Orders count")} value={fmt(s.orders_count)} sub={`${tr("السابق: ", "Previous: ")}${fmt(s.prev_orders_count)}`} tr={tr} fmt={fmt} />
        <Stat label={tr("متوسط قيمة الطلب", "Average order value")} value={money(s.aov)} tr={tr} fmt={fmt} />
        <Stat label={tr("المنتجات المباعة", "Items sold")} value={fmt(s.items_sold)} tr={tr} fmt={fmt} />
        <Stat label={tr("الخصومات", "Discounts")} value={money(s.discounts)} tr={tr} fmt={fmt} />
        <Stat label={tr("الضرائب", "Taxes")} value={money(s.tax)} tr={tr} fmt={fmt} />
        <Stat label={tr("رسوم الشحن", "Shipping fees")} value={money(s.shipping)} tr={tr} fmt={fmt} />
        <Stat label={tr("الاستردادات", "Refunds")} value={money(s.refunds)} tr={tr} fmt={fmt} />
        <Stat label={tr("عدد المرتجعات", "Returns count")} value={fmt(s.returns_count)} tr={tr} fmt={fmt} />
      </div>
      <button onClick={() => downloadCSV("sales-summary.csv", [s])}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
        <Download className="h-3.5 w-3.5" />{tr("تصدير CSV", "Export CSV")}
      </button>
    </>
  );
}

function BarRow({ label, value, max, fmt }: any) {
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

function TrendsView({ t, tr, fmt }: any) {
  const dayMax = Math.max(1, ...t.day.map((d: any) => d.revenue));
  const hourMax = Math.max(1, ...t.hour.map((d: any) => d.orders));
  const wkMax = Math.max(1, ...t.weekday.map((d: any) => d.orders));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={tr("المبيعات اليومية", "Daily sales")} action={<ExportBtn name="daily.csv" rows={t.day} tr={tr} />}>
        <div className="space-y-1">
          {t.day.slice(-30).map((d: any) => <BarRow key={d.bucket} label={d.bucket} value={d.revenue} max={dayMax} fmt={fmt} />)}
        </div>
      </Card>
      <Card title={tr("أكثر ساعات الطلب", "Top order hours")} action={<ExportBtn name="hours.csv" rows={t.hour} tr={tr} />}>
        <div className="space-y-1">
          {t.hour.map((d: any) => <BarRow key={d.bucket} label={d.bucket} value={d.orders} max={hourMax} fmt={fmt} />)}
        </div>
      </Card>
      <Card title={tr("أكثر أيام الطلب", "Top order weekdays")} action={<ExportBtn name="weekdays.csv" rows={t.weekday} tr={tr} />}>
        <div className="space-y-1">
          {t.weekday.map((d: any) => <BarRow key={d.bucket} label={d.bucket} value={d.orders} max={wkMax} fmt={fmt} />)}
        </div>
      </Card>
    </div>
  );
}

function ProductsView({ p, tr, fmt, money }: any) {
  return (
    <div className="space-y-4">
      <Card title={tr("الأكثر مبيعًا", "Top sellers")} action={<ExportBtn name="top-products.csv" rows={p.top} tr={tr} />}>
        <Table cols={[tr("المنتج", "Product"), tr("الكمية", "Qty"), tr("الإيرادات", "Revenue")]} tr={tr}
          rows={p.top.map((r: any) => [r.name, fmt(r.qty), money(r.revenue)])} />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`${tr("نفدت من المخزون", "Out of stock")} (${p.inv.out_of_stock.length})`}>
          <Table cols={[tr("المنتج", "Product"), tr("السعر", "Price")]} tr={tr}
            rows={p.inv.out_of_stock.map((r: any) => [r.name_ar, money(Number(r.price))])} />
        </Card>
        <Card title={`${tr("مخزون منخفض", "Low stock")} (${p.inv.low_stock.length})`}>
          <Table cols={[tr("المنتج", "Product"), tr("المخزون", "Stock")]} tr={tr}
            rows={p.inv.low_stock.map((r: any) => [r.name_ar, r.stock])} />
        </Card>
      </div>
    </div>
  );
}

function CustomersView({ c, tr, fmt, money }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("عملاء جدد", "New customers")} value={fmt(c.new_count)} tr={tr} fmt={fmt} />
        <Stat label={tr("عملاء متكررون", "Returning customers")} value={fmt(c.returning_count)} tr={tr} fmt={fmt} />
        <Stat label={tr("معدل تكرار الشراء", "Repeat purchase rate")} value={`${fmt(c.repeat_rate)}%`} tr={tr} fmt={fmt} />
        <Stat label={tr("متوسط LTV", "Average LTV")} value={money(c.ltv_avg)} tr={tr} fmt={fmt} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tr("أفضل العملاء", "Top customers")} action={<ExportBtn name="top-customers.csv" rows={c.top} tr={tr} />}>
          <Table cols={[tr("العميل", "Customer"), tr("الطلبات", "Orders"), tr("الإجمالي", "Total")]} tr={tr}
            rows={c.top.map((r: any) => [r.name || r.email, r.orders, money(r.spent)])} />
        </Card>
        <Card title={tr("عملاء غير نشطين (>90 يوم)", "Inactive customers (>90 days)")} action={<ExportBtn name="inactive.csv" rows={c.inactive} tr={tr} />}>
          <Table cols={[tr("العميل", "Customer"), tr("آخر طلب", "Last order"), tr("إجمالي", "Total")]} tr={tr}
            rows={c.inactive.map((r: any) => [r.name || r.email, r.last_order_at?.slice(0,10), money(r.spent)])} />
        </Card>
        <Card title={tr("المدن الأعلى شراءً", "Top spending cities")} action={<ExportBtn name="cities.csv" rows={c.cities} tr={tr} />}>
          <Table cols={[tr("المدينة", "City"), tr("الطلبات", "Orders"), tr("الإيرادات", "Revenue")]} tr={tr}
            rows={c.cities.map((r: any) => [r.city, r.orders, money(r.revenue)])} />
        </Card>
      </div>
    </div>
  );
}

function AbandonedView({ a, tr, fmt, money }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("عدد السلات", "Carts count")} value={fmt(a.count)} tr={tr} fmt={fmt} />
        <Stat label={tr("قيمة السلات", "Carts value")} value={money(a.total_value)} tr={tr} fmt={fmt} />
        <Stat label={tr("معدل الاستعادة", "Recovery rate")} value={`${fmt(a.recovery_rate)}%`} tr={tr} fmt={fmt} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title={tr("مرحلة الترك", "Abandonment stage")}><Table cols={[tr("المرحلة", "Stage"), tr("العدد", "Count")]} tr={tr} rows={a.stages.map((r:any)=>[r.stage, r.count])} /></Card>
        <Card title={tr("الأسباب", "Reasons")}><Table cols={[tr("السبب", "Reason"), tr("العدد", "Count")]} tr={tr} rows={a.reasons.map((r:any)=>[r.reason, r.count])} /></Card>
        <Card title={tr("منتجات متروكة", "Abandoned products")} action={<ExportBtn name="abandoned-products.csv" rows={a.top_products} tr={tr} />}>
          <Table cols={[tr("المنتج", "Product"), tr("الكمية", "Qty")]} tr={tr} rows={a.top_products.map((r:any)=>[r.name, r.qty])} />
        </Card>
      </div>
    </div>
  );
}

function IncompleteView({ i, tr, fmt, money }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={tr("عدد الطلبات", "Orders count")} value={fmt(i.total_count)} tr={tr} fmt={fmt} />
        <Stat label={tr("قيمة الفرص الضائعة", "Lost opportunity value")} value={money(i.lost_value)} tr={tr} fmt={fmt} />
      </div>
      <Card title={tr("حسب الحالة", "By status")} action={<ExportBtn name="incomplete.csv" rows={i.by_status} tr={tr} />}>
        <Table cols={[tr("الحالة", "Status"), tr("العدد", "Count"), tr("القيمة", "Value")]} tr={tr}
          rows={i.by_status.map((r: any) => [r.status, r.count, money(r.value)])} />
      </Card>
    </div>
  );
}

function TrafficView({ t, tr, fmt }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("عدد الزيارات", "Visits")} value={fmt(t.visits)} tr={tr} fmt={fmt} />
        <Stat label={tr("زوار فريدون", "Unique visitors")} value={fmt(t.unique_visitors)} tr={tr} fmt={fmt} />
        <Stat label={tr("معدل الارتداد", "Bounce rate")} value={`${fmt(t.bounce_rate)}%`} tr={tr} fmt={fmt} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tr("مصادر الزيارات", "Traffic sources")} action={<ExportBtn name="sources.csv" rows={t.sources} tr={tr} />}>
          <Table cols={[tr("المصدر", "Source"), tr("الزيارات", "Visits")]} tr={tr} rows={t.sources.map((r:any)=>[r.source, r.count])} />
        </Card>
        <Card title={tr("الصفحات الأكثر زيارة", "Most visited pages")} action={<ExportBtn name="pages.csv" rows={t.top_pages} tr={tr} />}>
          <Table cols={[tr("الصفحة", "Page"), tr("المشاهدات", "Views")]} tr={tr} rows={t.top_pages.map((r:any)=>[r.path, r.views])} />
        </Card>
      </div>
    </div>
  );
}

function FunnelView({ f, tr, fmt }: any) {
  const max = Math.max(1, ...f.map((s: any) => s.count));
  return (
    <Card title={tr("مسار التحويل (Funnel)", "Conversion Funnel")} action={<ExportBtn name="funnel.csv" rows={f} tr={tr} />}>
      <div className="space-y-3">
        {f.map((s: any, idx: number) => (
          <div key={s.step}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{idx + 1}. {s.step}</span>
              <span className="tabular-nums text-muted-foreground">
                {fmt(s.count)} · {fmt(s.pct_total)}% {tr("من الإجمالي", "of total")}
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

function PaymentsView({ p, tr, fmt, money }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tr("ناجحة", "Successful")} value={fmt(p.success)} tr={tr} fmt={fmt} />
        <Stat label={tr("فاشلة", "Failed")} value={fmt(p.failed)} tr={tr} fmt={fmt} />
        <Stat label={tr("قيد المعالجة", "Pending")} value={fmt(p.pending)} tr={tr} fmt={fmt} />
        <Stat label={tr("مستردة", "Refunded")} value={fmt(p.refunded)} tr={tr} fmt={fmt} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tr("طرق الدفع", "Payment methods")} action={<ExportBtn name="methods.csv" rows={p.methods} tr={tr} />}>
          <Table cols={[tr("الطريقة", "Method"), tr("العدد", "Count"), tr("المبلغ", "Amount")]} tr={tr}
            rows={p.methods.map((r: any) => [r.method, r.count, money(r.amount)])} />
        </Card>
        <Card title={tr("فشل البوابات", "Gateway failures")} action={<ExportBtn name="gateways.csv" rows={p.gateway_failure} tr={tr} />}>
          <Table cols={[tr("البوابة", "Gateway"), tr("نجاح", "Success"), tr("فشل", "Failed"), tr("نسبة الفشل", "Failure rate")]} tr={tr}
            rows={p.gateway_failure.map((r: any) => [r.gateway, r.success, r.failed, `${fmt(r.failure_rate)}%`])} />
        </Card>
      </div>
    </div>
  );
}

function ShippingView({ s, tr, money }: any) {
  return (
    <div className="space-y-4">
      <Stat label={tr("إجمالي تكلفة الشحن", "Total shipping cost")} value={money(s.total_cost)} tr={tr} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tr("حسب شركة الشحن", "By carrier")} action={<ExportBtn name="carriers.csv" rows={s.carriers} tr={tr} />}>
          <Table cols={[tr("الشركة", "Carrier"), tr("الشحنات", "Shipments"), tr("تم التسليم", "Delivered"), tr("فشل", "Failed"), tr("التكلفة", "Cost")]} tr={tr}
            rows={s.carriers.map((r: any) => [r.carrier, r.count, r.delivered, r.failed, money(r.cost)])} />
        </Card>
        <Card title={tr("مدن ذات مشاكل", "Problem cities")} action={<ExportBtn name="problem-cities.csv" rows={s.problem_cities} tr={tr} />}>
          <Table cols={[tr("المدينة", "City"), tr("المشاكل", "Issues")]} tr={tr} rows={s.problem_cities.map((r: any) => [r.city, r.issues])} />
        </Card>
      </div>
    </div>
  );
}

function CouponsView({ c, tr }: any) {
  return (
    <Card title={tr("أكثر الكوبونات استخدامًا", "Most used coupons")} action={<ExportBtn name="coupons.csv" rows={c.top} tr={tr} />}>
      <Table cols={[tr("الكود", "Code"), tr("مرات الاستخدام", "Uses"), tr("الخصم", "Discount")]} tr={tr}
        rows={c.top.map((r: any) => [r.code, r.uses, r.discount])} />
    </Card>
  );
}

function SchedulesView({ d, reload, tr, TABS, isAr }: { d: any; reload: () => void; tr: any; TABS: any[]; isAr: boolean }) {
  const [name, setName] = useState("");
  const [reportKey, setReportKey] = useState<TabKey>("sales");
  const [frequency, setFrequency] = useState("daily");
  const [recipients, setRecipients] = useState("");

  async function add() {
    if (!name || !recipients) { toast.error(tr("أدخل الاسم والمستلمين", "Enter name and recipients")); return; }
    const emails = recipients.split(/[,;\s]+/).filter(Boolean);
    const next = new Date();
    if (frequency === "daily") next.setDate(next.getDate() + 1);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    const { error } = await supabase.from("report_schedules").insert({
      name, report_key: reportKey, frequency, recipients: emails, next_run_at: next.toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(tr("تمت الجدولة", "Scheduled"));
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
    else { toast.success(tr("تم تنفيذ التقرير وتسجيله", "Report executed and logged")); reload(); }
  }

  return (
    <div className="space-y-4">
      <Card title={tr("جدولة جديدة", "New schedule")}>
        <div className="grid gap-3 md:grid-cols-5">
          <input className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder={tr("الاسم", "Name")}
            value={name} onChange={(e) => setName(e.target.value)} />
          <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={reportKey} onChange={(e) => setReportKey(e.target.value as TabKey)}>
            {TABS.filter((t: any) => t.key !== "schedules").map((t: any) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="daily">{tr("يومي", "Daily")}</option>
            <option value="weekly">{tr("أسبوعي", "Weekly")}</option>
            <option value="monthly">{tr("شهري", "Monthly")}</option>
          </select>
          <input className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder={tr("emails مفصولة بفواصل", "Emails comma separated")}
            value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          <button onClick={add} className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            <Plus className="h-4 w-4" />{tr("إضافة", "Add")}
          </button>
        </div>
      </Card>

      <Card title={`${tr("الجدولات", "Schedules")} (${d.schedules.length})`}>
        <Table cols={[tr("الاسم", "Name"), tr("التقرير", "Report"), tr("التكرار", "Frequency"), tr("المستلمون", "Recipients"), tr("الحالة", "Status"), tr("إجراءات", "Actions")]} tr={tr}
          rows={d.schedules.map((s: any) => [
            s.name,
            TABS.find((t: any) => t.key === s.report_key)?.label ?? s.report_key,
            s.frequency,
            (s.recipients as string[]).join(", "),
            <button key="t" onClick={() => toggle(s.id, !s.is_enabled)}
              className={`rounded-full px-2 py-0.5 text-[10px] ${s.is_enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {s.is_enabled ? tr("مفعّل", "Enabled") : tr("معطّل", "Disabled")}
            </button>,
            <div key="a" className="flex gap-1">
              <button onClick={() => runNow(s)} className="rounded p-1 hover:bg-muted" title={tr("تنفيذ الآن", "Run now")}><Play className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(s.id)} className="rounded p-1 text-red-600 hover:bg-muted" title={tr("حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>,
          ])} />
      </Card>

      <Card title={tr("سجل التشغيل", "Execution log")}>
        <Table cols={[tr("التاريخ", "Date"), tr("التقرير", "Report"), tr("الحالة", "Status"), tr("المستلمون", "Recipients")]} tr={tr}
          rows={d.runs.map((r: any) => [
            new Date(r.created_at).toLocaleString(isAr ? "ar-SA" : "en-US"),
            TABS.find((t: any) => t.key === r.report_key)?.label ?? r.report_key,
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

function Table({ cols, rows, tr }: { cols: string[]; rows: any[][]; tr: any }) {
  if (!rows.length) return <p className="py-4 text-center text-xs text-muted-foreground">{tr("لا توجد بيانات", "No data")}</p>;
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

function ExportBtn({ name, rows, tr }: { name: string; rows: any[]; tr: any }) {
  return (
    <button onClick={() => downloadCSV(name, rows)}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">
      <Download className="h-3 w-3" />{tr ? tr("CSV", "CSV") : "CSV"}
    </button>
  );
}
