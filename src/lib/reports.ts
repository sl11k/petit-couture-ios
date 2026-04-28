// Reports library — real data queries against Supabase
// All functions accept a date range and return analytic data ready for UI.

import { supabase } from "@/integrations/supabase/client";

export type DateRange = { from: Date; to: Date };

export type SalesSummary = {
  gross_sales: number;
  net_sales: number;
  orders_count: number;
  aov: number;
  items_sold: number;
  discounts: number;
  tax: number;
  shipping: number;
  refunds: number;
  returns_count: number;
  // comparison
  prev_gross_sales: number;
  prev_orders_count: number;
  growth_pct: number;
};

const ISO = (d: Date) => d.toISOString();

function shiftRange(range: DateRange): DateRange {
  const ms = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - ms), to: new Date(range.from.getTime() - 1) };
}

// 1) General sales report
export async function getSalesSummary(range: DateRange): Promise<SalesSummary> {
  const { data: orders } = await supabase
    .from("orders")
    .select("id,total,subtotal,tax,shipping_fee,refunded_amount,status,payment_status,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to));

  const list = orders ?? [];
  const valid = list.filter((o: any) => o.status !== "cancelled");
  const gross = valid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const refunds = valid.reduce((s: number, o: any) => s + Number(o.refunded_amount || 0), 0);
  const tax = valid.reduce((s: number, o: any) => s + Number(o.tax || 0), 0);
  const shipping = valid.reduce((s: number, o: any) => s + Number(o.shipping_fee || 0), 0);
  const subtotal = valid.reduce((s: number, o: any) => s + Number(o.subtotal || 0), 0);
  const discounts = Math.max(0, subtotal + tax + shipping - gross);
  const net = gross - refunds;

  // items
  const orderIds = valid.map((o: any) => o.id);
  let items_sold = 0;
  if (orderIds.length) {
    const { data: items } = await supabase
      .from("order_items")
      .select("qty")
      .in("order_id", orderIds);
    items_sold = (items ?? []).reduce((s: number, i: any) => s + Number(i.qty || 0), 0);
  }

  // returns
  const { count: returns_count } = await supabase
    .from("payment_refunds")
    .select("id", { count: "exact", head: true })
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to));

  // previous period
  const prev = shiftRange(range);
  const { data: prevOrders } = await supabase
    .from("orders")
    .select("total,status")
    .gte("created_at", ISO(prev.from))
    .lte("created_at", ISO(prev.to));
  const prevValid = (prevOrders ?? []).filter((o: any) => o.status !== "cancelled");
  const prev_gross = prevValid.reduce((s: number, o: any) => s + Number(o.total || 0), 0);

  return {
    gross_sales: gross,
    net_sales: net,
    orders_count: valid.length,
    aov: valid.length ? gross / valid.length : 0,
    items_sold,
    discounts,
    tax,
    shipping,
    refunds,
    returns_count: returns_count ?? 0,
    prev_gross_sales: prev_gross,
    prev_orders_count: prevValid.length,
    growth_pct: prev_gross > 0 ? ((gross - prev_gross) / prev_gross) * 100 : gross > 0 ? 100 : 0,
  };
}

// 2) Time series — daily / hourly buckets
export type TimePoint = { bucket: string; orders: number; revenue: number };

export async function getTimeSeries(
  range: DateRange,
  granularity: "day" | "hour" | "weekday" = "day"
): Promise<TimePoint[]> {
  const { data: orders } = await supabase
    .from("orders")
    .select("total,status,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to))
    .neq("status", "cancelled");

  const map = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders ?? []) {
    const d = new Date(o.created_at);
    let key: string;
    if (granularity === "hour") key = String(d.getHours()).padStart(2, "0") + ":00";
    else if (granularity === "weekday")
      key = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][d.getDay()];
    else key = d.toISOString().slice(0, 10);
    const cur = map.get(key) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number((o as any).total || 0);
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([bucket, v]) => ({ bucket, ...v }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

// 3) Products report
export type ProductRow = {
  product_id: string | null;
  name: string;
  qty: number;
  revenue: number;
};

export async function getTopProducts(range: DateRange, limit = 20): Promise<ProductRow[]> {
  const { data } = await supabase
    .from("order_items")
    .select("product_id,product_name,qty,line_total,order_id,orders!inner(created_at,status)")
    .gte("orders.created_at", ISO(range.from))
    .lte("orders.created_at", ISO(range.to))
    .neq("orders.status", "cancelled");
  const agg = new Map<string, ProductRow>();
  for (const it of (data ?? []) as any[]) {
    const key = it.product_id ?? it.product_name;
    const cur = agg.get(key) ?? {
      product_id: it.product_id,
      name: it.product_name,
      qty: 0,
      revenue: 0,
    };
    cur.qty += Number(it.qty || 0);
    cur.revenue += Number(it.line_total || 0);
    agg.set(key, cur);
  }
  return Array.from(agg.values()).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export async function getInventoryHealth(): Promise<{
  out_of_stock: any[];
  low_stock: any[];
}> {
  const { data: out } = await supabase
    .from("products")
    .select("id,name_ar,stock,price")
    .lte("stock", 0)
    .limit(50);
  const { data: low } = await supabase
    .from("products")
    .select("id,name_ar,stock,price")
    .gt("stock", 0)
    .lte("stock", 5)
    .limit(50);
  return { out_of_stock: out ?? [], low_stock: low ?? [] };
}

// 4) Customers report
export type CustomerRow = {
  user_id: string | null;
  email: string;
  name: string;
  orders: number;
  spent: number;
  last_order_at: string | null;
};

export async function getCustomersReport(range: DateRange): Promise<{
  new_count: number;
  returning_count: number;
  top: CustomerRow[];
  inactive: CustomerRow[];
  cities: { city: string; orders: number; revenue: number }[];
  ltv_avg: number;
  repeat_rate: number;
}> {
  const { data: orders } = await supabase
    .from("orders")
    .select("user_id,customer_email,customer_name,total,shipping_address,created_at,status")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(5000);
  const list = (orders ?? []) as any[];
  const inRange = list.filter(
    (o) => new Date(o.created_at) >= range.from && new Date(o.created_at) <= range.to
  );

  const byCustomer = new Map<string, CustomerRow>();
  for (const o of list) {
    const key = o.user_id ?? o.customer_email;
    if (!key) continue;
    const cur = byCustomer.get(key) ?? {
      user_id: o.user_id,
      email: o.customer_email,
      name: o.customer_name,
      orders: 0,
      spent: 0,
      last_order_at: null,
    };
    cur.orders += 1;
    cur.spent += Number(o.total || 0);
    if (!cur.last_order_at || cur.last_order_at < o.created_at) cur.last_order_at = o.created_at;
    byCustomer.set(key, cur);
  }

  const customers = Array.from(byCustomer.values());
  const repeat = customers.filter((c) => c.orders > 1).length;
  const top = [...customers].sort((a, b) => b.spent - a.spent).slice(0, 20);

  // new vs returning in range
  const inRangeKeys = new Set(inRange.map((o) => o.user_id ?? o.customer_email));
  let new_count = 0;
  let returning_count = 0;
  for (const k of inRangeKeys) {
    const c = byCustomer.get(k as string);
    if (!c) continue;
    if (c.orders === 1) new_count += 1;
    else returning_count += 1;
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const inactive = customers
    .filter((c) => c.last_order_at && new Date(c.last_order_at) < ninetyDaysAgo)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 20);

  // cities
  const cityMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of inRange) {
    const city = (o.shipping_address?.city as string) ?? "غير محدد";
    const cur = cityMap.get(city) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total || 0);
    cityMap.set(city, cur);
  }
  const cities = Array.from(cityMap.entries())
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  return {
    new_count,
    returning_count,
    top,
    inactive,
    cities,
    ltv_avg: customers.length ? customers.reduce((s, c) => s + c.spent, 0) / customers.length : 0,
    repeat_rate: customers.length ? (repeat / customers.length) * 100 : 0,
  };
}

// 5) Abandoned carts report
export async function getAbandonedReport(range: DateRange) {
  const { data } = await supabase
    .from("abandoned_carts")
    .select("id,subtotal,items,stage,converted,reached_checkout,abandonment_reason,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to));
  const list = (data ?? []) as any[];
  const total_value = list.reduce((s, c) => s + Number(c.subtotal || 0), 0);
  const recovered = list.filter((c) => c.converted).length;
  const stages = new Map<string, number>();
  const reasons = new Map<string, number>();
  const products = new Map<string, number>();
  for (const c of list) {
    stages.set(c.stage, (stages.get(c.stage) ?? 0) + 1);
    if (c.abandonment_reason)
      reasons.set(c.abandonment_reason, (reasons.get(c.abandonment_reason) ?? 0) + 1);
    for (const it of (c.items as any[]) ?? []) {
      const name = it.name ?? it.product_name ?? "—";
      products.set(name, (products.get(name) ?? 0) + Number(it.qty || 1));
    }
  }
  return {
    count: list.length,
    total_value,
    recovery_rate: list.length ? (recovered / list.length) * 100 : 0,
    stages: Array.from(stages.entries()).map(([stage, count]) => ({ stage, count })),
    reasons: Array.from(reasons.entries()).map(([reason, count]) => ({ reason, count })),
    top_products: Array.from(products.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10),
  };
}

// 6) Incomplete orders
export async function getIncompleteReport(range: DateRange) {
  const { data } = await supabase
    .from("orders")
    .select("id,status,payment_status,total,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to))
    .in("payment_status", ["unpaid", "failed", "pending_review", "pending"]);
  const list = (data ?? []) as any[];
  const groups = new Map<string, { count: number; value: number }>();
  for (const o of list) {
    const key = o.payment_status;
    const cur = groups.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(o.total || 0);
    groups.set(key, cur);
  }
  return {
    total_count: list.length,
    lost_value: list.reduce((s, o) => s + Number(o.total || 0), 0),
    by_status: Array.from(groups.entries()).map(([status, v]) => ({ status, ...v })),
  };
}

// 7) Visits / traffic
export async function getTrafficReport(range: DateRange) {
  const { data } = await supabase
    .from("analytics_events")
    .select("session_id,event_name,path,referrer,metadata,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to))
    .limit(5000);
  const list = (data ?? []) as any[];
  const sessions = new Set(list.map((e) => e.session_id));
  const pageViews = list.filter((e) => e.event_name === "page_view");
  const sources = new Map<string, number>();
  const pages = new Map<string, number>();
  for (const e of pageViews) {
    const ref = (e.referrer ?? "") as string;
    let src = "Direct";
    if (ref.includes("google")) src = "Google";
    else if (/facebook|instagram|tiktok|twitter|x\.com|snapchat/.test(ref)) src = "Social";
    else if (/wa\.me|whatsapp/.test(ref)) src = "WhatsApp";
    else if (/utm_source=email/.test(ref)) src = "Email";
    else if (/utm_medium=cpc|gclid|fbclid/.test(ref)) src = "Ads";
    else if (ref) src = "Referral";
    sources.set(src, (sources.get(src) ?? 0) + 1);
    if (e.path) pages.set(e.path, (pages.get(e.path) ?? 0) + 1);
  }
  // bounce: sessions with only 1 page_view
  const sessionViews = new Map<string, number>();
  for (const e of pageViews)
    sessionViews.set(e.session_id, (sessionViews.get(e.session_id) ?? 0) + 1);
  const bounces = Array.from(sessionViews.values()).filter((v) => v === 1).length;
  return {
    visits: pageViews.length,
    unique_visitors: sessions.size,
    bounce_rate: sessionViews.size ? (bounces / sessionViews.size) * 100 : 0,
    sources: Array.from(sources.entries()).map(([source, count]) => ({ source, count })),
    top_pages: Array.from(pages.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15),
  };
}

// 8) Funnel
export async function getFunnelReport(range: DateRange) {
  const steps = [
    { key: "page_view", label: "زار الموقع" },
    { key: "view_item", label: "شاهد منتج" },
    { key: "add_to_cart", label: "أضاف للسلة" },
    { key: "begin_checkout", label: "دخل Checkout" },
    { key: "add_shipping_info", label: "اختار الشحن" },
    { key: "add_payment_info", label: "اختار الدفع" },
    { key: "purchase", label: "أتم الطلب" },
  ];
  const { data } = await supabase
    .from("analytics_events")
    .select("session_id,event_name")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to))
    .in(
      "event_name",
      steps.map((s) => s.key)
    );
  const sessionsByStep = new Map<string, Set<string>>();
  for (const s of steps) sessionsByStep.set(s.key, new Set());
  for (const e of (data ?? []) as any[]) {
    sessionsByStep.get(e.event_name)?.add(e.session_id);
  }
  const first = sessionsByStep.get("page_view")?.size || 0;
  return steps.map((s, i) => {
    const count = sessionsByStep.get(s.key)?.size || 0;
    const prev = i > 0 ? sessionsByStep.get(steps[i - 1].key)?.size || 0 : count;
    return {
      step: s.label,
      count,
      pct_total: first ? (count / first) * 100 : 0,
      drop_off: prev ? ((prev - count) / prev) * 100 : 0,
    };
  });
}

// 9) Payments report
export async function getPaymentsReport(range: DateRange) {
  const { data } = await supabase
    .from("payment_transactions")
    .select("gateway,gateway_method,status,amount,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to));
  const list = (data ?? []) as any[];
  const methods = new Map<string, { count: number; amount: number }>();
  const gateways = new Map<string, { success: number; failed: number; total: number }>();
  let success = 0,
    failed = 0,
    pending = 0,
    refunded = 0;
  for (const t of list) {
    const m = t.gateway_method ?? t.gateway ?? "—";
    const mc = methods.get(m) ?? { count: 0, amount: 0 };
    mc.count += 1;
    mc.amount += Number(t.amount || 0);
    methods.set(m, mc);
    const g = gateways.get(t.gateway) ?? { success: 0, failed: 0, total: 0 };
    g.total += 1;
    if (t.status === "success" || t.status === "captured") {
      g.success += 1;
      success += 1;
    } else if (t.status === "failed") {
      g.failed += 1;
      failed += 1;
    } else if (t.status === "refunded") refunded += 1;
    else pending += 1;
    gateways.set(t.gateway, g);
  }
  return {
    success,
    failed,
    pending,
    refunded,
    methods: Array.from(methods.entries()).map(([method, v]) => ({ method, ...v })),
    gateway_failure: Array.from(gateways.entries()).map(([gateway, v]) => ({
      gateway,
      ...v,
      failure_rate: v.total ? (v.failed / v.total) * 100 : 0,
    })),
  };
}

// 10) Shipping report
export async function getShippingReport(range: DateRange) {
  const { data } = await supabase
    .from("orders")
    .select("shipping_carrier,shipping_status,shipping_fee,shipping_address,created_at")
    .gte("created_at", ISO(range.from))
    .lte("created_at", ISO(range.to));
  const list = (data ?? []) as any[];
  const carriers = new Map<
    string,
    { count: number; cost: number; delivered: number; failed: number }
  >();
  const cityIssues = new Map<string, number>();
  for (const o of list) {
    const c = o.shipping_carrier ?? "غير محدد";
    const cur = carriers.get(c) ?? { count: 0, cost: 0, delivered: 0, failed: 0 };
    cur.count += 1;
    cur.cost += Number(o.shipping_fee || 0);
    if (o.shipping_status === "delivered") cur.delivered += 1;
    if (o.shipping_status === "failed" || o.shipping_status === "returned") {
      cur.failed += 1;
      const city = (o.shipping_address?.city as string) ?? "—";
      cityIssues.set(city, (cityIssues.get(city) ?? 0) + 1);
    }
    carriers.set(c, cur);
  }
  return {
    carriers: Array.from(carriers.entries()).map(([carrier, v]) => ({ carrier, ...v })),
    problem_cities: Array.from(cityIssues.entries())
      .map(([city, issues]) => ({ city, issues }))
      .sort((a, b) => b.issues - a.issues)
      .slice(0, 10),
    total_cost: list.reduce((s, o) => s + Number(o.shipping_fee || 0), 0),
  };
}

// 11) Coupons report
export async function getCouponsReport(range: DateRange) {
  const { data: coupons } = await supabase
    .from("coupons")
    .select("id,code,used_count,discount_value,discount_type")
    .order("used_count", { ascending: false })
    .limit(50);
  // Note: we don't store coupon_code per order in this schema; report on coupons table directly.
  const list = (coupons ?? []) as any[];
  return {
    top: list.map((c) => ({
      code: c.code,
      uses: c.used_count,
      discount: `${c.discount_value} ${c.discount_type === "percent" ? "%" : "ر.س"}`,
    })),
    range_label: `${range.from.toISOString().slice(0, 10)} → ${range.to.toISOString().slice(0, 10)}`,
  };
}

// CSV export helper
export function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, any>[]) {
  const csv = toCSV(rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
