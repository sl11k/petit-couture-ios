import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/reports";
import { toast } from "sonner";
import {
  Activity, Eye, Users, Clock, MousePointerClick, ShoppingCart, TrendingUp,
  Megaphone, UserX, RefreshCw, Download, Search as SearchIcon, ScrollText,
} from "lucide-react";

export const Route = createFileRoute("/admin/site-analytics")({ component: SitePage });

type TabKey = "visits" | "behavior" | "commerce" | "campaigns" | "incomplete";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "visits", label: "الزيارات", icon: Eye },
  { key: "behavior", label: "سلوك المستخدم", icon: MousePointerClick },
  { key: "commerce", label: "التجارة", icon: ShoppingCart },
  { key: "campaigns", label: "الحملات", icon: Megaphone },
  { key: "incomplete", label: "غير المكملين", icon: UserX },
];

const PRESETS = [
  { key: "today", label: "اليوم", days: 0 },
  { key: "7d", label: "7 أيام", days: 7 },
  { key: "30d", label: "30 يوم", days: 30 },
  { key: "90d", label: "90 يوم", days: 90 },
];

const fmt = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
const money = (n: number) => `${fmt(n)} ر.س`;
const pct = (n: number) => `${fmt(n)}%`;
const ISO = (d: Date) => d.toISOString();

// Detect source from referrer + utm metadata
function detectSource(ref: string, meta: any): string {
  const utm = meta?.utm_source as string | undefined;
  if (utm) return utm;
  if (!ref) return "Direct";
  if (/google/.test(ref)) return "Google";
  if (/facebook|instagram|tiktok|twitter|x\.com|snapchat/.test(ref)) return "Social";
  if (/wa\.me|whatsapp/.test(ref)) return "WhatsApp";
  if (/utm_medium=email/.test(ref)) return "Email";
  if (/gclid|fbclid|utm_medium=cpc/.test(ref)) return "Ads";
  return "Referral";
}

function SitePage() {
  const [tab, setTab] = useState<TabKey>("visits");
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; });
  const [to, setTo] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({});

  function applyPreset(key: string) {
    setPreset(key);
    const days = PRESETS.find((p) => p.key === key)?.days ?? 30;
    const f = new Date(); f.setDate(f.getDate() - days); f.setHours(0,0,0,0);
    const t = new Date(); t.setHours(23,59,59,999);
    setFrom(f); setTo(t);
  }

  async function load() {
    setLoading(true);
    try {
      // Pull events + orders + carts in parallel; reuse across tabs
      const [evRes, ordRes, cartRes] = await Promise.all([
        supabase.from("analytics_events").select("session_id,user_id,event_name,path,referrer,metadata,user_agent,created_at")
          .gte("created_at", ISO(from)).lte("created_at", ISO(to)).limit(10000),
        supabase.from("orders").select("id,user_id,customer_email,total,status,payment_status,created_at,shipping_address")
          .gte("created_at", ISO(from)).lte("created_at", ISO(to)),
        supabase.from("abandoned_carts").select("id,session_id,email,phone,user_id,subtotal,items,stage,reached_checkout,converted,updated_at")
          .gte("updated_at", ISO(from)).lte("updated_at", ISO(to)).limit(2000),
      ]);
      const events = (evRes.data ?? []) as any[];
      const orders = (ordRes.data ?? []) as any[];
      const carts = (cartRes.data ?? []) as any[];
      setData({ events, orders, carts });
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ في التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  return (
    <AdminShell>
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">تحليلات الموقع</h1>
            <p className="text-sm text-muted-foreground">سلوك الزوار، الحملات، ومسار التحويل</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.key} onClick={() => applyPreset(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${preset === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {p.label}
              </button>
            ))}
            <input type="date" value={from.toISOString().slice(0,10)}
              onChange={(e) => { setPreset(""); setFrom(new Date(e.target.value)); }}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs" />
            <input type="date" value={to.toISOString().slice(0,10)}
              onChange={(e) => { setPreset(""); const d = new Date(e.target.value); d.setHours(23,59,59,999); setTo(d); }}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs" />
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

        <section>
          {loading && <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>}
          {!loading && data.events && (
            <>
              {tab === "visits" && <Visits events={data.events} />}
              {tab === "behavior" && <Behavior events={data.events} />}
              {tab === "commerce" && <Commerce events={data.events} orders={data.orders} carts={data.carts} />}
              {tab === "campaigns" && <Campaigns events={data.events} orders={data.orders} />}
              {tab === "incomplete" && <Incomplete events={data.events} orders={data.orders} carts={data.carts} />}
            </>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

// ─── 1) Visits ─────────────────────────────────────────────────────
function Visits({ events }: { events: any[] }) {
  const pageViews = events.filter((e) => e.event_name === "page_view");
  const sessions = new Map<string, { user_id?: string; views: number; first: number; last: number; firstSeenUser?: boolean }>();
  for (const e of pageViews) {
    const t = new Date(e.created_at).getTime();
    const cur = sessions.get(e.session_id) ?? { user_id: e.user_id, views: 0, first: t, last: t };
    cur.views += 1;
    cur.first = Math.min(cur.first, t);
    cur.last = Math.max(cur.last, t);
    sessions.set(e.session_id, cur);
  }
  const uniqueUsers = new Set(pageViews.map((e) => e.user_id ?? e.session_id));
  // new vs returning: session_id seen before in window? Approximate using first occurrence.
  const seenSessionsByUser = new Map<string, Set<string>>();
  for (const [sid, s] of sessions) {
    const key = s.user_id ?? sid;
    const set = seenSessionsByUser.get(key) ?? new Set();
    set.add(sid);
    seenSessionsByUser.set(key, set);
  }
  const newUsers = Array.from(seenSessionsByUser.values()).filter((s) => s.size === 1).length;
  const returningUsers = seenSessionsByUser.size - newUsers;
  const avgPagesPerSession = sessions.size ? pageViews.length / sessions.size : 0;
  const durations = Array.from(sessions.values()).map((s) => Math.max(0, (s.last - s.first) / 1000));
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const bounces = Array.from(sessions.values()).filter((s) => s.views === 1).length;
  const bounceRate = sessions.size ? (bounces / sessions.size) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat icon={Eye} label="عدد الزيارات" value={fmt(pageViews.length)} />
      <Stat icon={Users} label="الزوار الفريدون" value={fmt(uniqueUsers.size)} />
      <Stat icon={Activity} label="الجلسات" value={fmt(sessions.size)} />
      <Stat icon={Users} label="مستخدمون جدد" value={fmt(newUsers)} />
      <Stat icon={Users} label="مستخدمون عائدون" value={fmt(returningUsers)} />
      <Stat icon={ScrollText} label="صفحات لكل جلسة" value={fmt(avgPagesPerSession)} />
      <Stat icon={Clock} label="مدة الجلسة" value={`${fmt(avgDuration)}ث`} />
      <Stat icon={TrendingUp} label="معدل الارتداد" value={pct(bounceRate)} />
    </div>
  );
}

// ─── 2) Behavior ─────────────────────────────────────────────────
function Behavior({ events }: { events: any[] }) {
  const pages = new Map<string, number>();
  const products = new Map<string, number>();
  const searches = new Map<string, number>();
  const noResults = new Map<string, number>();
  const clicks = new Map<string, number>();
  const scrolls: number[] = [];

  for (const e of events) {
    if (e.event_name === "page_view" && e.path) pages.set(e.path, (pages.get(e.path) ?? 0) + 1);
    if (e.event_name === "view_item") {
      const name = (e.metadata?.name as string) ?? (e.metadata?.product_name as string) ?? (e.metadata?.product_id as string) ?? e.path ?? "—";
      products.set(name, (products.get(name) ?? 0) + 1);
    }
    if (e.event_name === "search") {
      const q = (e.metadata?.query as string) ?? "";
      if (q) {
        searches.set(q, (searches.get(q) ?? 0) + 1);
        if (e.metadata?.results_count === 0) noResults.set(q, (noResults.get(q) ?? 0) + 1);
      }
    }
    if (e.event_name === "click") {
      const label = (e.metadata?.label as string) ?? (e.metadata?.target as string) ?? "—";
      clicks.set(label, (clicks.get(label) ?? 0) + 1);
    }
    if (e.event_name === "scroll_depth") {
      const d = Number(e.metadata?.depth);
      if (!Number.isNaN(d)) scrolls.push(d);
    }
  }
  const avgScroll = scrolls.length ? scrolls.reduce((a, b) => a + b, 0) / scrolls.length : 0;

  return (
    <div className="space-y-4">
      <Stat icon={ScrollText} label="متوسط Scroll Depth" value={pct(avgScroll)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الصفحات الأكثر زيارة" action={<Csv name="pages.csv" rows={mapRows(pages, ["page", "views"])} />}>
          <Table cols={["الصفحة", "المشاهدات"]} rows={topMap(pages, 20)} />
        </Card>
        <Card title="المنتجات الأكثر مشاهدة" action={<Csv name="viewed-products.csv" rows={mapRows(products, ["product", "views"])} />}>
          <Table cols={["المنتج", "المشاهدات"]} rows={topMap(products, 20)} />
        </Card>
        <Card title="عمليات البحث" action={<Csv name="searches.csv" rows={mapRows(searches, ["query", "count"])} />}>
          <Table cols={["الكلمة", "المرات"]} rows={topMap(searches, 20)} />
        </Card>
        <Card title="بحث بدون نتائج" action={<Csv name="no-results.csv" rows={mapRows(noResults, ["query", "count"])} />}>
          <Table cols={["الكلمة", "المرات"]} rows={topMap(noResults, 20)} />
        </Card>
        <Card title="نقرات مهمة" action={<Csv name="clicks.csv" rows={mapRows(clicks, ["target", "count"])} />}>
          <Table cols={["العنصر", "النقرات"]} rows={topMap(clicks, 20)} />
        </Card>
      </div>
      <p className="text-[11px] text-muted-foreground">
        * تتبّع scroll_depth والنقرات يتم إذا أرسلَتها واجهة الموقع كأحداث (event_name = scroll_depth أو click).
        تسجيل الجلسات و Heatmap يُنصح بتفعيلها عبر مزود خارجي مثل Hotjar/Clarity مع التزام كامل بسياسة الخصوصية.
      </p>
    </div>
  );
}

// ─── 3) Commerce ────────────────────────────────────────────────
function Commerce({ events, orders, carts }: any) {
  const sessions = new Set<string>();
  const productViewers = new Set<string>();
  const addToCart = new Set<string>();
  const checkoutStart = new Set<string>();
  const purchase = new Set<string>();
  for (const e of events) {
    sessions.add(e.session_id);
    if (e.event_name === "view_item") productViewers.add(e.session_id);
    if (e.event_name === "add_to_cart") addToCart.add(e.session_id);
    if (e.event_name === "begin_checkout") checkoutStart.add(e.session_id);
    if (e.event_name === "purchase") purchase.add(e.session_id);
  }
  const visitors = sessions.size || 1;
  const validOrders = orders.filter((o: any) => o.status !== "cancelled");
  const revenue = validOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const aov = validOrders.length ? revenue / validOrders.length : 0;
  const rpv = revenue / visitors;
  const addRate = (addToCart.size / visitors) * 100;
  const checkoutRate = (checkoutStart.size / visitors) * 100;
  const purchaseRate = (purchase.size / visitors) * 100;
  const conversionRate = (validOrders.length / visitors) * 100;
  const cartAbandon = addToCart.size ? ((addToCart.size - purchase.size) / addToCart.size) * 100 : 0;
  const checkoutAbandon = checkoutStart.size ? ((checkoutStart.size - purchase.size) / checkoutStart.size) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Add to Cart Rate" value={pct(addRate)} />
      <Stat label="Checkout Start Rate" value={pct(checkoutRate)} />
      <Stat label="Purchase Rate" value={pct(purchaseRate)} />
      <Stat label="Conversion Rate" value={pct(conversionRate)} />
      <Stat label="Cart Abandonment" value={pct(cartAbandon)} />
      <Stat label="Checkout Abandonment" value={pct(checkoutAbandon)} />
      <Stat label="Revenue per Visitor" value={money(rpv)} />
      <Stat label="Average Order Value" value={money(aov)} />
    </div>
  );
}

// ─── 4) Campaigns / UTM ─────────────────────────────────────────
function Campaigns({ events, orders }: any) {
  const sources = new Map<string, { sessions: Set<string>; orders: number; revenue: number }>();
  const campaigns = new Map<string, { sessions: Set<string>; orders: number; revenue: number }>();
  const mediums = new Map<string, number>();
  const keywords = new Map<string, number>();
  const ads = new Map<string, number>();

  // session → source mapping (first touch)
  const sessionSource = new Map<string, { source: string; campaign?: string }>();
  for (const e of events) {
    if (!sessionSource.has(e.session_id)) {
      const src = detectSource(e.referrer ?? "", e.metadata);
      const camp = (e.metadata?.utm_campaign as string) ?? undefined;
      sessionSource.set(e.session_id, { source: src, campaign: camp });
    }
    const m = e.metadata ?? {};
    if (m.utm_medium) mediums.set(m.utm_medium, (mediums.get(m.utm_medium) ?? 0) + 1);
    if (m.utm_term) keywords.set(m.utm_term, (keywords.get(m.utm_term) ?? 0) + 1);
    if (m.utm_content) ads.set(m.utm_content, (ads.get(m.utm_content) ?? 0) + 1);
  }
  for (const [sid, info] of sessionSource) {
    const cur = sources.get(info.source) ?? { sessions: new Set(), orders: 0, revenue: 0 };
    cur.sessions.add(sid);
    sources.set(info.source, cur);
    if (info.campaign) {
      const cc = campaigns.get(info.campaign) ?? { sessions: new Set(), orders: 0, revenue: 0 };
      cc.sessions.add(sid);
      campaigns.set(info.campaign, cc);
    }
  }
  // Attribute orders by matching session_id present in events for that user/email — best-effort
  const orderSessions = new Map<string, string>(); // session→source
  for (const o of orders) {
    // find any event from the same user_id or email window
    const ev = events.find((e: any) =>
      (o.user_id && e.user_id === o.user_id) ||
      (o.customer_email && e.metadata?.email === o.customer_email)
    );
    if (ev) {
      const info = sessionSource.get(ev.session_id);
      if (info) {
        const s = sources.get(info.source);
        if (s) { s.orders += 1; s.revenue += Number(o.total || 0); }
        if (info.campaign) {
          const c = campaigns.get(info.campaign);
          if (c) { c.orders += 1; c.revenue += Number(o.total || 0); }
        }
      }
    }
  }

  const sourceRows = Array.from(sources.entries()).map(([source, v]) => ({
    source, sessions: v.sessions.size, orders: v.orders, revenue: v.revenue,
    cvr: v.sessions.size ? (v.orders / v.sessions.size) * 100 : 0,
  })).sort((a, b) => b.sessions - a.sessions);
  const campaignRows = Array.from(campaigns.entries()).map(([campaign, v]) => ({
    campaign, sessions: v.sessions.size, orders: v.orders, revenue: v.revenue,
  })).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="مصادر الزيارة" action={<Csv name="sources.csv" rows={sourceRows} />}>
          <Table cols={["المصدر", "الجلسات", "الطلبات", "التحويل", "الإيرادات"]}
            rows={sourceRows.map((r) => [r.source, fmt(r.sessions), fmt(r.orders), pct(r.cvr), money(r.revenue)])} />
        </Card>
        <Card title="الحملات (utm_campaign)" action={<Csv name="campaigns.csv" rows={campaignRows} />}>
          <Table cols={["الحملة", "الجلسات", "الطلبات", "الإيرادات"]}
            rows={campaignRows.map((r) => [r.campaign, fmt(r.sessions), fmt(r.orders), money(r.revenue)])} />
        </Card>
        <Card title="القنوات (utm_medium)"><Table cols={["القناة", "الزيارات"]} rows={topMap(mediums, 15)} /></Card>
        <Card title="الكلمات المفتاحية (utm_term)"><Table cols={["الكلمة", "الزيارات"]} rows={topMap(keywords, 15)} /></Card>
        <Card title="الإعلانات (utm_content)"><Table cols={["الإعلان", "الزيارات"]} rows={topMap(ads, 15)} /></Card>
      </div>
    </div>
  );
}

// ─── 5) Incomplete users ────────────────────────────────────────
function Incomplete({ events, orders, carts }: any) {
  const purchasedSessions = new Set<string>();
  const purchasedUsers = new Set<string>();
  for (const o of orders) {
    if (o.status !== "cancelled" && o.payment_status === "paid") {
      if (o.user_id) purchasedUsers.add(o.user_id);
      if (o.customer_email) purchasedUsers.add(o.customer_email);
    }
  }
  for (const e of events) {
    if (e.event_name === "purchase") purchasedSessions.add(e.session_id);
  }

  // 1) Added to cart but didn't buy
  const addedNoBuy = new Map<string, { session: string; email?: string; phone?: string; user_id?: string; subtotal: number; updated_at: string }>();
  for (const c of carts) {
    if (!c.converted) {
      addedNoBuy.set(c.id, {
        session: c.session_id, email: c.email, phone: c.phone, user_id: c.user_id,
        subtotal: Number(c.subtotal || 0), updated_at: c.updated_at,
      });
    }
  }

  // 2) Began checkout but didn't complete
  const beganCheckout: any[] = carts.filter((c: any) => c.reached_checkout && !c.converted);

  // 3) Failed payment
  const failedPay = orders.filter((o: any) => o.payment_status === "failed");

  // 4) Repeated product views without purchase (sessions with view_item ≥ 3 and no purchase)
  const sessionViewCount = new Map<string, number>();
  const sessionLastProduct = new Map<string, string>();
  for (const e of events) {
    if (e.event_name === "view_item") {
      sessionViewCount.set(e.session_id, (sessionViewCount.get(e.session_id) ?? 0) + 1);
      sessionLastProduct.set(e.session_id, (e.metadata?.name as string) ?? (e.metadata?.product_id as string) ?? "—");
    }
  }
  const repeatedViewers = Array.from(sessionViewCount.entries())
    .filter(([sid, c]) => c >= 3 && !purchasedSessions.has(sid))
    .map(([sid, c]) => ({ session: sid, views: c, last_product: sessionLastProduct.get(sid) ?? "—" }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={ShoppingCart} label="أضاف للسلة ولم يشترِ" value={fmt(addedNoBuy.size)} />
        <Stat icon={UserX} label="بدأ Checkout ولم يكمل" value={fmt(beganCheckout.length)} />
        <Stat icon={UserX} label="فشل دفعه" value={fmt(failedPay.length)} />
        <Stat icon={Eye} label="مشاهدات متكررة بدون شراء" value={fmt(repeatedViewers.length)} />
      </div>

      <Card title="أضاف للسلة ولم يشترِ"
        action={<Csv name="cart-no-buy.csv" rows={Array.from(addedNoBuy.values())} />}>
        <Table cols={["البريد", "الجوال", "قيمة السلة", "آخر تحديث"]}
          rows={Array.from(addedNoBuy.values()).slice(0, 100).map((r) => [
            r.email ?? "—", r.phone ?? "—", money(r.subtotal),
            new Date(r.updated_at).toLocaleString("ar-SA"),
          ])} />
      </Card>

      <Card title="بدأ Checkout ولم يكمل"
        action={<Csv name="checkout-incomplete.csv" rows={beganCheckout} />}>
        <Table cols={["البريد", "الجوال", "القيمة", "المرحلة"]}
          rows={beganCheckout.slice(0, 100).map((r: any) => [
            r.email ?? "—", r.phone ?? "—", money(Number(r.subtotal || 0)), r.stage,
          ])} />
      </Card>

      <Card title="فشل الدفع"
        action={<Csv name="failed-pay.csv" rows={failedPay.map((o:any)=>({email:o.customer_email, total:o.total, created_at:o.created_at}))} />}>
        <Table cols={["البريد", "المجموع", "التاريخ"]}
          rows={failedPay.slice(0, 100).map((o: any) => [
            o.customer_email, money(Number(o.total || 0)), new Date(o.created_at).toLocaleString("ar-SA"),
          ])} />
      </Card>

      <Card title="مشاهدات منتج متكررة بدون شراء"
        action={<Csv name="repeated-viewers.csv" rows={repeatedViewers} />}>
        <Table cols={["الجلسة", "عدد المشاهدات", "آخر منتج"]}
          rows={repeatedViewers.slice(0, 100).map((r) => [r.session.slice(0, 12) + "…", r.views, r.last_product])} />
      </Card>

      <p className="text-[11px] text-muted-foreground">
        * يتم تصدير العملاء بحدود ما يسمح به نظام الموافقات (notification_preferences). تأكد من احترام تفضيلات التسويق قبل أي تواصل.
      </p>
    </div>
  );
}

// ─── shared ────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </div>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
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
function Csv({ name, rows }: { name: string; rows: any[] }) {
  return (
    <button onClick={() => downloadCSV(name, rows)}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">
      <Download className="h-3 w-3" />CSV
    </button>
  );
}
function topMap(m: Map<string, number>, n: number) {
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, fmt(v)]);
}
function mapRows(m: Map<string, number>, cols: [string, string]) {
  return Array.from(m.entries()).map(([k, v]) => ({ [cols[0]]: k, [cols[1]]: v }));
}
