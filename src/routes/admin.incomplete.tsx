import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/state/AuthContext";
import { toast } from "sonner";
import {
  AlertCircle,
  Clock,
  CreditCard,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Send,
  MessageSquare,
  Mail,
  Phone,
  Package,
  Eye,
  Search,
  ShoppingCart,
  Banknote,
  PackageX,
} from "lucide-react";

export const Route = createFileRoute("/admin/incomplete")({
  component: IncompleteOrdersPage,
});

type Bucket =
  | "abandoned_cart"
  | "checkout_incomplete"
  | "order_unpaid"
  | "payment_failed"
  | "manual_pending"
  | "bank_transfer_review";

type IncompleteRow = {
  id: string;
  bucket: Bucket;
  ref: string; // order_number or session_id
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  total: number;
  currency: string;
  last_stage: string;
  reason: string;
  last_activity: string;
  expires_at?: string | null;
  payment_link?: string | null;
  source?: string;
  created_by_admin?: boolean;
  raw: any;
};

const BUCKETS: { value: Bucket | "all"; label: string; icon: any; tone: string }[] = [
  { value: "all", label: "الكل", icon: AlertCircle, tone: "bg-muted text-foreground" },
  { value: "abandoned_cart", label: "سلة متروكة", icon: ShoppingCart, tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "checkout_incomplete", label: "Checkout غير مكتمل", icon: Clock, tone: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "order_unpaid", label: "طلب بدون دفع", icon: CreditCard, tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "payment_failed", label: "دفع فشل", icon: XCircle, tone: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { value: "manual_pending", label: "طلب يدوي بانتظار الدفع", icon: Phone, tone: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "bank_transfer_review", label: "تحويل بنكي للمراجعة", icon: Banknote, tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
];

function bucketMeta(b: Bucket) {
  return BUCKETS.find((x) => x.value === b)!;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

function timeUntil(iso?: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { text: "منتهي", expired: true };
  const h = Math.floor(diff / 3600000);
  if (h < 1) return { text: `${Math.floor(diff / 60000)} د متبقية`, expired: false };
  if (h < 48) return { text: `${h} س متبقية`, expired: false };
  return { text: `${Math.floor(h / 24)} ي متبقية`, expired: false };
}

function IncompleteOrdersPage() {
  const { user } = useAuth();
  const { canEditOrders, canManage, isAdmin } = useUserRole();
  const [rows, setRows] = useState<IncompleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState<Bucket | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<IncompleteRow | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const sevenDays = new Date(Date.now() - 7 * 86400000).toISOString();

    const [cartsRes, ordersRes] = await Promise.all([
      supabase
        .from("abandoned_carts")
        .select("*")
        .eq("converted", false)
        .gte("updated_at", sevenDays)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("orders")
        .select("*")
        .in("status", ["pending"])
        .in("payment_status", ["unpaid", "failed", "pending_review", "expired"])
        .gte("created_at", sevenDays)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const merged: IncompleteRow[] = [];

    for (const c of cartsRes.data ?? []) {
      const isCheckout = c.reached_checkout || c.stage === "checkout" || c.stage === "shipping" || c.stage === "payment";
      merged.push({
        id: `cart_${c.id}`,
        bucket: isCheckout ? "checkout_incomplete" : "abandoned_cart",
        ref: c.session_id,
        name: c.email || c.phone || "مجهول",
        phone: c.phone,
        email: c.email,
        total: Number(c.subtotal || 0),
        currency: c.currency || "SAR",
        last_stage: stageLabel(c.stage, c.reached_checkout),
        reason: guessReason(c.stage, c.abandonment_reason),
        last_activity: c.updated_at,
        source: c.source,
        raw: c,
      });
    }

    for (const o of ordersRes.data ?? []) {
      let bucket: Bucket = "order_unpaid";
      if (o.payment_method === "bank_transfer" && o.payment_status === "pending_review") {
        bucket = "bank_transfer_review";
      } else if (o.payment_status === "failed") {
        bucket = "payment_failed";
      } else if (o.created_by_admin) {
        bucket = "manual_pending";
      }

      merged.push({
        id: `order_${o.id}`,
        bucket,
        ref: o.order_number,
        name: o.customer_name,
        phone: o.customer_phone,
        email: o.customer_email,
        total: Number(o.total || 0),
        currency: o.currency || "SAR",
        last_stage: o.last_stage || stageLabel(null, true),
        reason: paymentReason(o),
        last_activity: o.updated_at || o.created_at,
        expires_at: o.expires_at,
        payment_link: o.payment_link,
        source: o.source,
        created_by_admin: o.created_by_admin,
        raw: o,
      });
    }

    setRows(merged);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (activeBucket !== "all" && r.bucket !== activeBucket) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.ref.toLowerCase().includes(q) ||
          (r.name || "").toLowerCase().includes(q) ||
          (r.phone || "").includes(q) ||
          (r.email || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, activeBucket, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.bucket] = (c[r.bucket] || 0) + 1;
    return c;
  }, [rows]);

  async function logAudit(action: string, entity_id: string, metadata: any = {}) {
    if (!user) return;
    await supabase.from("audit_logs").insert({
      action,
      entity: "incomplete_order",
      entity_id,
      actor_id: user.id,
      actor_email: user.email,
      metadata,
    });
  }

  async function resendPaymentLink(row: IncompleteRow) {
    if (!canEditOrders) return toast.error("لا تملك الصلاحية");
    if (!row.id.startsWith("order_")) return toast.error("متاح فقط للطلبات المنشأة");
    const orderId = row.raw.id;
    const link = row.payment_link || `${window.location.origin}/order-confirmation/${row.ref}`;
    await supabase
      .from("orders")
      .update({ payment_link: link, payment_link_sent_at: new Date().toISOString() })
      .eq("id", orderId);
    await logAudit("payment_link_resent", orderId, { link });
    toast.success("تم تحديث وقت إرسال رابط الدفع");
    void loadAll();
  }

  async function convertToConfirmed(row: IncompleteRow) {
    if (!canEditOrders) return toast.error("لا تملك الصلاحية");
    if (!row.id.startsWith("order_")) return toast.error("الطلب لم يُنشأ بعد");
    const orderId = row.raw.id;
    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_status: "paid",
        bank_transfer_reviewed_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    await logAudit("manual_confirm_payment", orderId, { previous: row.raw.payment_status });
    toast.success("تم تأكيد الطلب يدويًا");
    setSelected(null);
    void loadAll();
  }

  async function cancelAndRelease(row: IncompleteRow) {
    if (!canManage) return toast.error("هذه العملية للأدمن/المدير فقط");
    if (!row.id.startsWith("order_")) {
      // for carts, just mark abandoned with a reason
      await supabase
        .from("abandoned_carts")
        .update({ abandonment_reason: "cancelled_by_admin", contact_status: "contacted" })
        .eq("id", row.raw.id);
      toast.success("تم تعليم السلة كمُلغاة");
      void loadAll();
      return;
    }
    const orderId = row.raw.id;
    if (row.raw.stock_reserved) {
      await supabase.rpc("release_expired_order_stock" as any, { _order_id: orderId } as any);
    }
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        payment_status: "expired",
        stock_released_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    await logAudit("manual_cancel_incomplete", orderId, { stock_released: row.raw.stock_reserved });
    toast.success("تم الإلغاء واسترجاع المخزون");
    setSelected(null);
    void loadAll();
  }

  async function setExpiry(row: IncompleteRow, hours: number) {
    if (!canEditOrders) return;
    if (!row.id.startsWith("order_")) return;
    const expires = new Date(Date.now() + hours * 3600000).toISOString();
    await supabase
      .from("orders")
      .update({ expires_at: expires, auto_cancel_after_hours: hours })
      .eq("id", row.raw.id);
    await logAudit("set_auto_cancel", row.raw.id, { hours });
    toast.success(`سيُلغى تلقائيًا بعد ${hours} ساعة`);
    void loadAll();
  }

  async function runAutoCancelNow() {
    if (!isAdmin) return toast.error("للأدمن فقط");
    const { data, error } = await supabase.rpc("auto_cancel_expired_orders" as any);
    if (error) return toast.error(error.message);
    toast.success(`تم إلغاء ${data ?? 0} طلب منتهي`);
    void loadAll();
  }

  function whatsappLink(row: IncompleteRow) {
    if (!row.phone) return null;
    const phone = row.phone.replace(/[^\d]/g, "");
    const link = row.payment_link || `${window.location.origin}/cart`;
    const msg = encodeURIComponent(
      `مرحبًا ${row.name || ""}، لاحظنا أنك لم تُكمل طلبك (${row.ref}). يمكنك إكمال الدفع من هنا: ${link}`,
    );
    return `https://wa.me/${phone}?text=${msg}`;
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">الطلبات غير المكتملة</h1>
          <p className="text-sm text-muted-foreground">سلات متروكة، Checkout ناقص، وطلبات بانتظار الدفع</p>
        </div>
        {/* Top actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب، الاسم، الجوال، البريد..."
              className="w-full pr-10 pl-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadAll()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" /> تحديث
            </button>
            {isAdmin && (
              <button
                onClick={runAutoCancelNow}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm hover:opacity-90"
              >
                <PackageX className="h-4 w-4" /> إلغاء المنتهية الآن
              </button>
            )}
          </div>
        </div>

        {/* Bucket tabs */}
        <div className="flex flex-wrap gap-2">
          {BUCKETS.map((b) => {
            const Icon = b.icon;
            const active = activeBucket === b.value;
            return (
              <button
                key={b.value}
                onClick={() => setActiveBucket(b.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{b.label}</span>
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-muted">{counts[b.value] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد طلبات غير مكتملة في هذا التصنيف</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-right p-3 font-medium">الحالة</th>
                    <th className="text-right p-3 font-medium">المرجع</th>
                    <th className="text-right p-3 font-medium">العميل</th>
                    <th className="text-right p-3 font-medium">القيمة</th>
                    <th className="text-right p-3 font-medium">آخر خطوة</th>
                    <th className="text-right p-3 font-medium">السبب</th>
                    <th className="text-right p-3 font-medium">آخر نشاط</th>
                    <th className="text-right p-3 font-medium">المهلة</th>
                    <th className="text-right p-3 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const meta = bucketMeta(r.bucket);
                    const Icon = meta.icon;
                    const expiry = timeUntil(r.expires_at);
                    return (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${meta.tone}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">{r.ref}</td>
                        <td className="p-3">
                          <div className="font-medium">{r.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.phone || r.email || ""}</div>
                        </td>
                        <td className="p-3 font-medium">
                          {r.total.toFixed(2)} {r.currency}
                        </td>
                        <td className="p-3 text-xs">{r.last_stage}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[180px] truncate" title={r.reason}>
                          {r.reason}
                        </td>
                        <td className="p-3 text-xs whitespace-nowrap">{timeAgo(r.last_activity)}</td>
                        <td className="p-3 text-xs whitespace-nowrap">
                          {expiry ? (
                            <span className={expiry.expired ? "text-destructive font-medium" : "text-amber-600"}>
                              {expiry.text}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelected(r)}
                              className="p-1.5 rounded hover:bg-muted"
                              title="تفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {whatsappLink(r) && (
                              <a
                                href={whatsappLink(r)!}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded hover:bg-muted text-emerald-600"
                                title="واتساب"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </a>
                            )}
                            {r.email && (
                              <a
                                href={`mailto:${r.email}?subject=إكمال طلبك ${r.ref}`}
                                className="p-1.5 rounded hover:bg-muted text-blue-600"
                                title="بريد"
                              >
                                <Mail className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer
          row={selected}
          canEditOrders={canEditOrders}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onResendLink={() => resendPaymentLink(selected)}
          onConfirm={() => convertToConfirmed(selected)}
          onCancel={() => cancelAndRelease(selected)}
          onSetExpiry={(h) => setExpiry(selected, h)}
          whatsappLink={whatsappLink(selected)}
        />
      )}
    </AdminShell>
  );
}

function DetailDrawer({
  row,
  canEditOrders,
  canManage,
  onClose,
  onResendLink,
  onConfirm,
  onCancel,
  onSetExpiry,
  whatsappLink,
}: {
  row: IncompleteRow;
  canEditOrders: boolean;
  canManage: boolean;
  onClose: () => void;
  onResendLink: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSetExpiry: (h: number) => void;
  whatsappLink: string | null;
}) {
  const meta = bucketMeta(row.bucket);
  const Icon = meta.icon;
  const isOrder = row.id.startsWith("order_");
  const items = isOrder ? [] : (row.raw.items ?? []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-background overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${meta.tone}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            <h2 className="text-xl font-bold mt-2 font-mono">{row.ref}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-muted">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">العميل</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">الاسم</div>
                <div>{row.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">الجوال</div>
                <div>{row.phone || "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">البريد</div>
                <div>{row.email || "—"}</div>
              </div>
            </div>
          </section>

          {/* Status */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">الحالة والمراحل</h3>
            <div className="space-y-2 text-sm">
              <Row label="آخر خطوة" value={row.last_stage} />
              <Row label="السبب المحتمل" value={row.reason} />
              <Row label="القيمة" value={`${row.total.toFixed(2)} ${row.currency}`} />
              <Row label="المصدر" value={row.source || "—"} />
              <Row label="آخر نشاط" value={timeAgo(row.last_activity)} />
              {row.expires_at && (
                <Row label="ينتهي في" value={new Date(row.expires_at).toLocaleString("ar")} />
              )}
              {isOrder && row.raw.stock_reserved && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  <Package className="h-4 w-4" />
                  المخزون محجوز لهذا الطلب — سيُسترجع عند الإلغاء
                </div>
              )}
            </div>
          </section>

          {/* Cart items (for carts) */}
          {!isOrder && items.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">المنتجات في السلة</h3>
              <div className="space-y-2">
                {items.map((it: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border border-border text-sm">
                    <span>{it.name || it.product_name || "منتج"}</span>
                    <span className="text-muted-foreground">×{it.qty || it.quantity || 1}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bank transfer proof */}
          {row.bucket === "bank_transfer_review" && (
            <section>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">تفاصيل التحويل البنكي</h3>
              <div className="space-y-2 text-sm">
                <Row label="رقم المرجع" value={row.raw.bank_transfer_reference || "—"} />
                {row.raw.bank_transfer_proof_url && (
                  <a
                    href={row.raw.bank_transfer_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-xs underline"
                  >
                    عرض إثبات التحويل
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Actions */}
          <section className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">الإجراءات</h3>
            <div className="grid grid-cols-2 gap-2">
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-600 text-white text-sm hover:opacity-90"
                >
                  <MessageSquare className="h-4 w-4" /> تواصل واتساب
                </a>
              )}
              {row.email && (
                <a
                  href={`mailto:${row.email}?subject=إكمال طلبك ${row.ref}`}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-blue-600 text-white text-sm hover:opacity-90"
                >
                  <Mail className="h-4 w-4" /> إرسال بريد
                </a>
              )}
              {row.phone && (
                <a
                  href={`tel:${row.phone}`}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> اتصال
                </a>
              )}
              {isOrder && canEditOrders && (
                <button
                  onClick={onResendLink}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  <Send className="h-4 w-4" /> إعادة إرسال رابط الدفع
                </button>
              )}
              {isOrder && canEditOrders && (
                <button
                  onClick={onConfirm}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 col-span-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> تحويله لطلب مؤكد يدويًا
                </button>
              )}
            </div>

            {/* Expiry control */}
            {isOrder && canEditOrders && (
              <div className="mt-4 p-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground mb-2">ضبط مهلة الإلغاء التلقائي</div>
                <div className="flex gap-2">
                  {[24, 48, 72, 168].map((h) => (
                    <button
                      key={h}
                      onClick={() => onSetExpiry(h)}
                      className="flex-1 py-2 px-2 text-xs rounded border border-border hover:bg-muted"
                    >
                      {h < 168 ? `${h} ساعة` : "أسبوع"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cancel */}
            {canManage && (
              <button
                onClick={onCancel}
                className="mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-destructive text-destructive text-sm hover:bg-destructive/10"
              >
                <PackageX className="h-4 w-4" />
                إلغاء واسترجاع المخزون
              </button>
            )}

            {isOrder && (
              <Link
                to="/admin/orders/$id"
                params={{ id: row.raw.id }}
                className="mt-3 block text-center text-xs text-primary hover:underline"
              >
                فتح صفحة الطلب الكاملة ←
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function stageLabel(stage?: string | null, reachedCheckout?: boolean): string {
  if (stage === "payment") return "صفحة الدفع";
  if (stage === "shipping") return "اختيار الشحن";
  if (stage === "checkout") return "بداية Checkout";
  if (reachedCheckout) return "Checkout";
  return "السلة";
}

function guessReason(stage?: string | null, explicit?: string | null): string {
  if (explicit) return explicit;
  if (stage === "payment") return "ترك صفحة الدفع — قد يكون بسبب طريقة الدفع أو السعر النهائي";
  if (stage === "shipping") return "تردد بشأن تكلفة الشحن";
  if (stage === "checkout") return "احتاج معلومات إضافية أو انشغل";
  return "ترك السلة دون إكمال";
}

function paymentReason(o: any): string {
  if (o.payment_failure_reason) return o.payment_failure_reason;
  if (o.payment_status === "failed") return "فشل عملية الدفع — قد تكون البطاقة مرفوضة";
  if (o.payment_status === "pending_review") return "بانتظار مراجعة التحويل البنكي";
  if (o.created_by_admin) return "طلب يدوي بانتظار تأكيد الدفع من العميل";
  if (!o.payment_link_sent_at) return "لم يُرسل رابط الدفع بعد";
  return "العميل لم يُكمل الدفع بعد إنشاء الطلب";
}
