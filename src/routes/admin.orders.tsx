import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useTr } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  ORDER_STATUSES, ORDER_STATUS_COLOR,
  PAYMENT_STATUSES, PAYMENT_STATUS_COLOR,
  SHIPPING_STATUSES, SHIPPING_STATUS_COLOR,
  SHIPPING_CARRIERS,
  getOrderStatusLabel, getPaymentStatusLabel, getShippingStatusLabel, getOrderSourceLabel,
  Pill, logOrderEvent,
} from "@/lib/orderStatus";
import {
  Search, Filter, Download, Printer, MessageCircle, Mail, MapPin,
  Copy, Eye, X, ChevronDown, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersPage,
});

type Order = {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  total: number;
  currency: string;
  status: string;
  payment_status: string;
  shipping_status: string;
  payment_method: string;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  source: string;
  assigned_to: string | null;
  shipping_address: any;
  notes: string | null;
};

const PAGE_SIZE = 50;

function OrdersPage() {
  const navigate = useNavigate();
  const tr = useTr();
  const { lang } = useLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const ORDER_LABEL = getOrderStatusLabel(lang);
  const PAYMENT_LABEL = getPaymentStatusLabel(lang);
  const SHIPPING_LABEL = getShippingStatusLabel(lang);
  const SOURCE_LABEL = getOrderSourceLabel(lang);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [paymentF, setPaymentF] = useState("all");
  const [shippingF, setShippingF] = useState("all");
  const [carrierF, setCarrierF] = useState("all");
  const [cityF, setCityF] = useState("");
  const [paymentMethodF, setPaymentMethodF] = useState("all");
  const [sourceF, setSourceF] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");

  async function load() {
    setLoading(true);
    let q = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusF !== "all") q = q.eq("status", statusF as any);
    if (paymentF !== "all") q = q.eq("payment_status", paymentF);
    if (shippingF !== "all") q = q.eq("shipping_status", shippingF);
    if (carrierF !== "all") q = q.eq("shipping_carrier", carrierF);
    if (paymentMethodF !== "all") q = q.eq("payment_method", paymentMethodF as any);
    if (sourceF !== "all") q = q.eq("source", sourceF);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");

    if (quickFilter === "overdue") {
      const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();
      q = q.eq("status", "pending").lt("created_at", cutoff);
    }
    if (quickFilter === "payment_failed") q = q.eq("payment_status", "failed");
    if (quickFilter === "no_shipment") q = q.in("status", ["paid", "processing", "ready_to_ship"]).eq("shipping_status", "not_created");
    if (quickFilter === "needs_review") q = q.eq("status", "under_review");

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(
        `order_number.ilike.${s},customer_name.ilike.${s},customer_phone.ilike.${s},customer_email.ilike.${s},tracking_number.ilike.${s}`,
      );
    }

    const { data, count } = await q;
    let result = (data ?? []) as Order[];

    if (cityF.trim()) {
      const c = cityF.trim().toLowerCase();
      result = result.filter((o) => {
        const city = (o.shipping_address?.city ?? o.shipping_address?.cityName ?? "").toLowerCase();
        return city.includes(c);
      });
    }

    setOrders(result);
    setTotalCount(count ?? 0);
    setLoading(false);
    setSelected(new Set());
  }

  useEffect(() => {
    void load();
  }, [page, statusF, paymentF, shippingF, carrierF, paymentMethodF, sourceF, dateFrom, dateTo, quickFilter]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); void load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cityF]);

  function clearFilters() {
    setSearch(""); setStatusF("all"); setPaymentF("all"); setShippingF("all");
    setCarrierF("all"); setCityF(""); setPaymentMethodF("all"); setSourceF("all");
    setDateFrom(""); setDateTo(""); setQuickFilter(null); setPage(0);
  }

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (statusF !== "all") n++;
    if (paymentF !== "all") n++;
    if (shippingF !== "all") n++;
    if (carrierF !== "all") n++;
    if (paymentMethodF !== "all") n++;
    if (sourceF !== "all") n++;
    if (cityF) n++;
    if (dateFrom || dateTo) n++;
    if (quickFilter) n++;
    return n;
  }, [statusF, paymentF, shippingF, carrierF, paymentMethodF, sourceF, cityF, dateFrom, dateTo, quickFilter]);

  function toggleOne(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  }
  function toggleAll() {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  }

  async function runBulk() {
    if (selected.size === 0 || !bulkAction) return;
    const ids = [...selected];
    if (bulkAction === "export") return exportCsv(orders.filter((o) => selected.has(o.id)));
    if (bulkAction === "print_invoices") {
      ids.forEach((id, i) => setTimeout(() => window.open(`/admin/orders/${id}/invoice`, "_blank"), i * 200));
      return;
    }
    if (bulkAction === "print_awb") {
      ids.forEach((id, i) => setTimeout(() => window.open(`/admin/orders/${id}/awb`, "_blank"), i * 200));
      return;
    }
    if (bulkAction.startsWith("status:")) {
      const newStatus = bulkAction.split(":")[1];
      if (!confirm(tr(
        `تغيير حالة ${ids.length} طلب إلى "${ORDER_LABEL[newStatus]}"؟`,
        `Change status of ${ids.length} orders to "${ORDER_LABEL[newStatus]}"?`,
      ))) return;
      await supabase.from("orders").update({ status: newStatus as any }).in("id", ids);
      await Promise.all(ids.map((id) => logOrderEvent(id, "bulk_status_change", { to: newStatus })));
      await load();
    }
    if (bulkAction === "mark_reviewed") {
      await supabase.from("orders").update({ status: "processing" }).in("id", ids).eq("status", "under_review");
      await Promise.all(ids.map((id) => logOrderEvent(id, "marked_reviewed")));
      await load();
    }
    setBulkAction("");
  }

  function exportCsv(rows: Order[]) {
    const headers = tr(
      "رقم الطلب|التاريخ|العميل|الجوال|البريد|المدينة|الإجمالي|العملة|حالة الطلب|حالة الدفع|حالة الشحن|طريقة الدفع|شركة الشحن|رقم التتبع|المصدر",
      "Order #|Date|Customer|Phone|Email|City|Total|Currency|Order status|Payment status|Shipping status|Payment method|Carrier|Tracking #|Source",
    ).split("|");
    const lines = rows.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleString(locale),
      o.customer_name, o.customer_phone, o.customer_email,
      o.shipping_address?.city ?? "",
      o.total, o.currency,
      ORDER_LABEL[o.status] ?? o.status,
      PAYMENT_LABEL[o.payment_status] ?? o.payment_status,
      SHIPPING_LABEL[o.shipping_status] ?? o.shipping_status,
      o.payment_method, o.shipping_carrier ?? "", o.tracking_number ?? "",
      SOURCE_LABEL[o.source] ?? o.source,
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <AdminShell>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tr("الطلبات", "Orders")}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalCount} {tr("طلب · صفحة", "orders · page")} {page + 1} {tr("من", "of")} {Math.max(pageCount, 1)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportCsv(orders)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> {tr("تصدير CSV", "Export CSV")}
          </button>
          <Link to="/admin/create-order" className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">
            {tr("+ طلب جديد", "+ New order")}
          </Link>
        </div>
      </div>

      {/* Quick filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        {([
          ["overdue", tr("متأخرة (>3 أيام)", "Overdue (>3 days)"), "border-red-200 text-red-700"],
          ["payment_failed", tr("فشل الدفع", "Payment failed"), "border-orange-200 text-orange-700"],
          ["no_shipment", tr("لم تُشحن بعد", "Not shipped yet"), "border-amber-200 text-amber-700"],
          ["needs_review", tr("قيد المراجعة", "Under review"), "border-blue-200 text-blue-700"],
        ] as const).map(([k, l, c]) => (
          <button
            key={k}
            onClick={() => setQuickFilter(quickFilter === k ? null : k)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition ${
              quickFilter === k ? "bg-primary border-primary text-primary-foreground" : `bg-card ${c} hover:bg-muted`
            }`}
          >
            <AlertTriangle className="h-3 w-3" /> {l}
          </button>
        ))}
      </div>

      {/* Search + filter toggle */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("بحث برقم الطلب، الاسم، الجوال، البريد، رقم التتبع...", "Search by order #, name, phone, email, tracking #...")}
            className="w-full rounded-md border border-border bg-background py-2 pr-9 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-muted"
        >
          <Filter className="h-3.5 w-3.5" />
          {tr("فلاتر", "Filters")}
          {activeFiltersCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFiltersCount}</span>
          )}
          <ChevronDown className={`h-3 w-3 transition ${showFilters ? "rotate-180" : ""}`} />
        </button>
        {activeFiltersCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
            <X className="h-3 w-3" /> {tr("مسح", "Clear")}
          </button>
        )}
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="mb-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label={tr("حالة الطلب", "Order status")} value={statusF} onChange={setStatusF}
            options={[["all", tr("الكل", "All")], ...ORDER_STATUSES.map((s) => [s, ORDER_LABEL[s]] as [string, string])]} />
          <Select label={tr("حالة الدفع", "Payment status")} value={paymentF} onChange={setPaymentF}
            options={[["all", tr("الكل", "All")], ...PAYMENT_STATUSES.map((s) => [s, PAYMENT_LABEL[s]] as [string, string])]} />
          <Select label={tr("حالة الشحن", "Shipping status")} value={shippingF} onChange={setShippingF}
            options={[["all", tr("الكل", "All")], ...SHIPPING_STATUSES.map((s) => [s, SHIPPING_LABEL[s]] as [string, string])]} />
          <Select label={tr("شركة الشحن", "Carrier")} value={carrierF} onChange={setCarrierF}
            options={[["all", tr("الكل", "All")], ...SHIPPING_CARRIERS.map((c) => [c, c] as [string, string])]} />
          <Select label={tr("طريقة الدفع", "Payment method")} value={paymentMethodF} onChange={setPaymentMethodF}
            options={[["all", tr("الكل", "All")], ["card", tr("بطاقة", "Card")], ["cod", tr("عند الاستلام", "Cash on delivery")], ["bank_transfer", tr("تحويل بنكي", "Bank transfer")], ["apple_pay", "Apple Pay"]]} />
          <Select label={tr("مصدر الطلب", "Order source")} value={sourceF} onChange={setSourceF}
            options={[["all", tr("الكل", "All")], ["web", tr("ويب", "Web")], ["mobile", tr("موبايل", "Mobile")], ["admin", tr("أدمن", "Admin")], ["whatsapp", tr("واتساب", "WhatsApp")]]} />
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">{tr("المدينة", "City")}</span>
            <input value={cityF} onChange={(e) => setCityF(e.target.value)} placeholder={tr("مثال: الرياض", "e.g. Riyadh")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{tr("من", "From")}</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs" />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{tr("إلى", "To")}</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs" />
            </label>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium text-primary">{selected.size} {tr("محدد", "selected")}</span>
          <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs">
            <option value="">{tr("— اختر إجراء —", "— Choose action —")}</option>
            <option value="export">{tr("تصدير المحدد (CSV)", "Export selected (CSV)")}</option>
            <option value="print_invoices">{tr("طباعة فواتير", "Print invoices")}</option>
            <option value="print_awb">{tr("طباعة بوالص الشحن", "Print shipping labels")}</option>
            <option value="mark_reviewed">{tr('تأشير "تمت المراجعة"', 'Mark as "Reviewed"')}</option>
            <optgroup label={tr("تغيير الحالة", "Change status")}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={`status:${s}`}>{tr("إلى:", "To:")} {ORDER_LABEL[s]}</option>
              ))}
            </optgroup>
          </select>
          <button onClick={runBulk} disabled={!bulkAction}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">
            {tr("تنفيذ", "Apply")}
          </button>
          <button onClick={() => setSelected(new Set())} className="rounded-md border border-border px-2 py-1 text-xs">
            {tr("إلغاء التحديد", "Clear selection")}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{tr("جاري التحميل...", "Loading...")}</p>
        ) : orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{tr("لا توجد طلبات تطابق الفلاتر", "No orders match the filters")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-[11px] text-muted-foreground">
              <tr>
                <th className="p-2.5 w-8">
                  <input type="checkbox" checked={selected.size === orders.length} onChange={toggleAll} />
                </th>
                <th className="p-2.5">{tr("رقم الطلب", "Order #")}</th>
                <th className="p-2.5">{tr("التاريخ", "Date")}</th>
                <th className="p-2.5">{tr("العميل", "Customer")}</th>
                <th className="p-2.5">{tr("المدينة", "City")}</th>
                <th className="p-2.5">{tr("الإجمالي", "Total")}</th>
                <th className="p-2.5">{tr("الدفع", "Payment")}</th>
                <th className="p-2.5">{tr("الطلب", "Order")}</th>
                <th className="p-2.5">{tr("الشحن", "Shipping")}</th>
                <th className="p-2.5">{tr("شركة/تتبع", "Carrier/Track")}</th>
                <th className="p-2.5">{tr("المصدر", "Source")}</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isOverdue = o.status === "pending" && Date.now() - new Date(o.created_at).getTime() > 3 * 86400000;
                const wa = o.customer_phone?.replace(/\D/g, "");
                return (
                  <tr
                    key={o.id}
                    className={`border-b border-border/50 last:border-0 align-top ${selected.has(o.id) ? "bg-primary/5" : "hover:bg-muted/30"}`}
                  >
                    <td className="p-2.5">
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} />
                    </td>
                    <td
                      className="cursor-pointer p-2.5"
                      onClick={() => navigate({ to: "/admin/orders/$id", params: { id: o.id } })}
                    >
                      <Link
                        to="/admin/orders/$id"
                        params={{ id: o.id }}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {o.order_number}
                      </Link>
                      {isOverdue && <div className="mt-0.5 flex items-center gap-1 text-[10px] text-red-600"><AlertTriangle className="h-3 w-3" /> {tr("متأخر", "Overdue")}</div>}
                    </td>
                    <td className="p-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                      <div className="text-[10px]">{new Date(o.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                    <td
                      className="cursor-pointer p-2.5"
                      onClick={() => navigate({ to: "/admin/orders/$id", params: { id: o.id } })}
                    >
                      <Link
                        to="/admin/orders/$id"
                        params={{ id: o.id }}
                        className="text-xs font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {o.customer_name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{o.customer_phone}</div>
                    </td>
                    <td className="p-2.5 text-[11px]">{o.shipping_address?.city ?? "—"}</td>
                    <td className="p-2.5 text-xs font-semibold whitespace-nowrap">{Number(o.total).toLocaleString(locale)} {o.currency}</td>
                    <td className="p-2.5"><Pill label={PAYMENT_LABEL[o.payment_status] ?? o.payment_status} color={PAYMENT_STATUS_COLOR[o.payment_status] ?? "bg-gray-100"} /></td>
                    <td className="p-2.5"><Pill label={ORDER_LABEL[o.status] ?? o.status} color={ORDER_STATUS_COLOR[o.status] ?? "bg-gray-100"} /></td>
                    <td className="p-2.5"><Pill label={SHIPPING_LABEL[o.shipping_status] ?? o.shipping_status} color={SHIPPING_STATUS_COLOR[o.shipping_status] ?? "bg-gray-100"} /></td>
                    <td className="p-2.5 text-[11px]">
                      {o.shipping_carrier && <div className="font-medium">{o.shipping_carrier}</div>}
                      {o.tracking_number && (
                        <div className="font-mono text-[10px] text-muted-foreground">{o.tracking_number}</div>
                      )}
                      {!o.shipping_carrier && !o.tracking_number && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2.5 text-[11px] text-muted-foreground">{SOURCE_LABEL[o.source] ?? o.source}</td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-0.5">
                        <Link to="/admin/orders/$id" params={{ id: o.id }} title={tr("عرض", "View")}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button onClick={() => navigator.clipboard.writeText(o.order_number)} title={tr("نسخ الرقم", "Copy number")}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a href={`/admin/orders/${o.id}/invoice`} target="_blank" rel="noreferrer" title={tr("طباعة الفاتورة", "Print invoice")}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Printer className="h-3.5 w-3.5" />
                        </a>
                        {wa && (
                          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(tr(`مرحباً، بخصوص طلبك ${o.order_number}`, `Hello, regarding your order ${o.order_number}`))}`}
                            target="_blank" rel="noreferrer" title="WhatsApp"
                            className="rounded p-1.5 text-green-600 hover:bg-green-50">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {o.customer_email && (
                          <a href={`mailto:${o.customer_email}?subject=${encodeURIComponent(tr("طلبك " + o.order_number, "Your order " + o.order_number))}`}
                            title={tr("إيميل", "Email")} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {o.shipping_address?.lat && o.shipping_address?.lng && (
                          <a href={`https://www.google.com/maps?q=${o.shipping_address.lat},${o.shipping_address.lng}`}
                            target="_blank" rel="noreferrer" title={tr("موقع العميل", "Customer location")}
                            className="rounded p-1.5 text-blue-600 hover:bg-blue-50">
                            <MapPin className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">{tr("السابق", "Previous")}</button>
          <span className="text-xs text-muted-foreground">{tr("صفحة", "Page")} {page + 1} / {pageCount}</span>
          <button disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">{tr("التالي", "Next")}</button>
        </div>
      )}
    </AdminShell>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
