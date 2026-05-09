import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import {
  ORDER_STATUSES, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR,
  PAYMENT_STATUSES, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_COLOR,
  SHIPPING_STATUSES, SHIPPING_STATUS_LABEL, SHIPPING_STATUS_COLOR,
  SHIPPING_CARRIERS, ORDER_SOURCE_LABEL,
  Pill, logOrderEvent,
} from "@/lib/orderStatus";
import {
  ArrowRight, Printer, MessageCircle, Mail, MapPin, Copy,
  Pin, Save, Trash2, Plus, Package as PackageIcon, AlertTriangle,
  Phone, User, Calendar, CreditCard, Truck, FileText, Clock, Send, Loader2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { otoCreateShipment } from "@/lib/oto.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

type Note = { text: string; author: string; at: string; pinned?: boolean };

function OrderDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [pinNew, setPinNew] = useState(false);
  const [tab, setTab] = useState<"overview" | "timeline" | "notes">("overview");

  async function load() {
    setLoading(true);
    try {
      const [oRes, iRes, eRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("audit_logs").select("*").eq("entity", "order").eq("entity_id", id).order("created_at", { ascending: false }),
      ]);
      if (oRes.error) console.error("[order detail] order load error:", oRes.error);
      if (iRes.error) console.error("[order detail] items load error:", iRes.error);
      if (eRes.error) console.error("[order detail] events load error:", eRes.error);
      setOrder(oRes.data ?? null);
      setItems(iRes.data ?? []);
      setEvents(eRes.data ?? []);
    } catch (e) {
      console.error("[order detail] load failed:", e);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function patch(updates: Record<string, any>, eventName?: string) {
    const { error } = await supabase.from("orders").update(updates as any).eq("id", id);
    if (error) return alert(error.message);
    if (eventName) await logOrderEvent(id, eventName, updates);
    await load();
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    const note: Note = {
      text: newNote.trim(),
      author: auth.user?.email ?? "موظف",
      at: new Date().toISOString(),
      pinned: pinNew,
    };
    const updated = [...(order.internal_notes ?? []), note];
    await supabase.from("orders").update({ internal_notes: updated }).eq("id", id);
    await logOrderEvent(id, "note_added", { pinned: pinNew });
    setNewNote(""); setPinNew(false);
    await load();
  }

  async function togglePin(idx: number) {
    const notes = [...(order.internal_notes ?? [])] as Note[];
    notes[idx] = { ...notes[idx], pinned: !notes[idx].pinned };
    await supabase.from("orders").update({ internal_notes: notes }).eq("id", id);
    await load();
  }

  async function removeNote(idx: number) {
    if (!confirm("حذف الملاحظة؟")) return;
    const notes = [...(order.internal_notes ?? [])] as Note[];
    notes.splice(idx, 1);
    await supabase.from("orders").update({ internal_notes: notes }).eq("id", id);
    await load();
  }

  if (loading) {
    return <AdminShell><p className="p-8 text-center text-sm text-muted-foreground">جاري التحميل...</p></AdminShell>;
  }
  if (!order) {
    return <AdminShell>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">الطلب غير موجود</p>
        <Link to="/admin/orders" className="mt-4 inline-block text-sm text-primary hover:underline">العودة للطلبات</Link>
      </div>
    </AdminShell>;
  }

  const addr = order.shipping_address ?? {};
  const wa = order.customer_phone?.replace(/\D/g, "");
  const notes = (order.internal_notes ?? []) as Note[];
  const pinnedNotes = notes.map((n, i) => ({ n, i })).filter((x) => x.n.pinned);
  const criticalNote = pinnedNotes.length > 0;

  // Compute totals
  const subtotal = items.reduce((s, it) => s + Number(it.line_total ?? 0), 0);

  return (
    <AdminShell>
      {/* Header / breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/orders" className="rounded-md border border-border p-1.5 hover:bg-muted">
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-semibold">{order.order_number}</h1>
              <button onClick={() => navigator.clipboard.writeText(order.order_number)} title="نسخ"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <Calendar className="inline h-3 w-3" /> {new Date(order.created_at).toLocaleString("ar")} ·
              من {ORDER_SOURCE_LABEL[order.source] ?? order.source}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/orders/${id}/invoice`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
            <Printer className="h-3.5 w-3.5" /> فاتورة
          </a>
          <a href={`/admin/orders/${id}/awb`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
            <Truck className="h-3.5 w-3.5" /> بوليصة شحن
          </a>
          {wa && (
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`مرحباً، بخصوص طلبك ${order.order_number}`)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1 rounded-md bg-green-500 px-3 py-1.5 text-xs text-white hover:bg-green-600">
              <MessageCircle className="h-3.5 w-3.5" /> واتساب
            </a>
          )}
          {order.customer_email && (
            <a href={`mailto:${order.customer_email}?subject=${encodeURIComponent("طلبك " + order.order_number)}`}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
              <Mail className="h-3.5 w-3.5" /> إيميل
            </a>
          )}
        </div>
      </div>

      {/* Critical note banner */}
      {criticalNote && (
        <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/50 p-3 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-amber-900 dark:text-amber-200">ملاحظات مثبّتة:</p>
              {pinnedNotes.map(({ n, i }) => (
                <p key={i} className="mt-1 text-amber-800 dark:text-amber-300">• {n.text}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status row — three side-by-side */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatusCard
          title="حالة الطلب" current={order.status}
          options={ORDER_STATUSES.map((s) => [s, ORDER_STATUS_LABEL[s]] as const)}
          color={ORDER_STATUS_COLOR[order.status]}
          label={ORDER_STATUS_LABEL[order.status] ?? order.status}
          onChange={(v) => patch({ status: v }, "status_change")}
        />
        <StatusCard
          title="حالة الدفع" current={order.payment_status}
          options={PAYMENT_STATUSES.map((s) => [s, PAYMENT_STATUS_LABEL[s]] as const)}
          color={PAYMENT_STATUS_COLOR[order.payment_status]}
          label={PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
          onChange={(v) => patch({ payment_status: v }, "payment_status_change")}
        />
        <StatusCard
          title="حالة الشحن" current={order.shipping_status}
          options={SHIPPING_STATUSES.map((s) => [s, SHIPPING_STATUS_LABEL[s]] as const)}
          color={SHIPPING_STATUS_COLOR[order.shipping_status]}
          label={SHIPPING_STATUS_LABEL[order.shipping_status] ?? order.shipping_status}
          onChange={(v) => patch({ shipping_status: v }, "shipping_status_change")}
        />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {([["overview", "نظرة عامة"], ["timeline", `Timeline (${events.length})`], ["notes", `ملاحظات داخلية (${notes.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs ${tab === k ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left column: items + totals */}
          <div className="space-y-4 lg:col-span-2">
            <Section title="المنتجات" icon={PackageIcon}>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-2">
                    {it.image_url && <img src={it.image_url} alt="" className="h-12 w-12 rounded object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{it.product_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {it.size && <>المقاس: {it.size} · </>}
                        {it.color && <>اللون: {it.color} · </>}
                        الكمية: {it.qty}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xs text-muted-foreground">{Number(it.unit_price).toLocaleString("ar-SA")} × {it.qty}</div>
                      <div className="text-sm font-semibold">{Number(it.line_total).toLocaleString("ar-SA")} {order.currency}</div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">لا توجد منتجات</p>}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                <Row label="المجموع الفرعي" value={`${subtotal.toLocaleString("ar-SA")} ${order.currency}`} />
                <Row label="الشحن" value={`${Number(order.shipping_fee).toLocaleString("ar-SA")} ${order.currency}`} />
                <Row label="الضريبة (15%)" value={`${Number(order.tax).toLocaleString("ar-SA")} ${order.currency}`} />
                <Row label="الإجمالي" value={`${Number(order.total).toLocaleString("ar-SA")} ${order.currency}`} bold />
              </div>
            </Section>

            <Section title="الشحن والتتبع" icon={Truck}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">شركة الشحن</span>
                  <select value={order.shipping_carrier ?? ""}
                    onChange={(e) => patch({ shipping_carrier: e.target.value || null }, "carrier_change")}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">— اختر —</option>
                    {SHIPPING_CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <InlineEdit label="رقم التتبع" value={order.tracking_number ?? ""} onSave={(v) => patch({ tracking_number: v || null }, "tracking_update")} />
                <InlineEdit label="رابط التتبع" value={order.tracking_url ?? ""} onSave={(v) => patch({ tracking_url: v || null }, "tracking_url_update")} />
                <InlineEdit label="رقم الفاتورة" value={order.invoice_number ?? ""} onSave={(v) => patch({ invoice_number: v || null })} />
              </div>
              {order.tracking_url && (
                <a href={order.tracking_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-primary hover:underline">
                  فتح رابط التتبع ↗
                </a>
              )}
              <OtoCreateShipmentButton orderId={order.id} hasTracking={!!order.tracking_number} onDone={load} />
            </Section>
          </div>

          {/* Right column: customer + address */}
          <div className="space-y-4">
            <Section title="العميل" icon={User}>
              <div className="space-y-1.5 text-sm">
                <div className="font-medium">{order.customer_name}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {order.customer_phone}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> {order.customer_email}
                </div>
              </div>
            </Section>

            <Section title="عنوان التوصيل" icon={MapPin}>
              <div className="space-y-1 text-xs">
                {addr.line1 && <div>{addr.line1}</div>}
                {addr.line2 && <div>{addr.line2}</div>}
                {(addr.district || addr.city) && (
                  <div className="text-muted-foreground">
                    {addr.district && <>{addr.district}، </>}{addr.city}
                  </div>
                )}
                {addr.postal_code && <div className="text-muted-foreground">{addr.postal_code}</div>}
                {addr.country && <div className="text-muted-foreground">{addr.country}</div>}
              </div>
              {addr.lat && addr.lng && (
                <a href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
                  <MapPin className="h-3 w-3" /> فتح في Google Maps
                </a>
              )}
              {order.notes && (
                <div className="mt-3 rounded-md bg-muted/40 p-2 text-[11px]">
                  <span className="font-semibold">ملاحظة العميل:</span> {order.notes}
                </div>
              )}
            </Section>

            <Section title="الدفع" icon={CreditCard}>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">الطريقة</span><span className="font-medium">{order.payment_method}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الحالة</span>
                  <Pill label={PAYMENT_STATUS_LABEL[order.payment_status]} color={PAYMENT_STATUS_COLOR[order.payment_status]} />
                </div>
                {order.idempotency_key && (
                  <div className="flex justify-between"><span className="text-muted-foreground">المعرّف</span><span className="font-mono text-[10px]">{order.idempotency_key.slice(0, 16)}...</span></div>
                )}
              </div>
            </Section>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <Section title="السجل الزمني" icon={Clock}>
          <ol className="relative space-y-4 border-r-2 border-border pr-4">
            <TimelineItem
              icon="✨" label="تم إنشاء الطلب"
              detail={`من ${ORDER_SOURCE_LABEL[order.source] ?? order.source}`}
              at={order.created_at}
            />
            {events.map((e) => (
              <TimelineItem
                key={e.id} icon="•"
                label={prettyAction(e.action)}
                detail={describeMeta(e.metadata)}
                at={e.created_at}
                actor={e.actor_email}
              />
            ))}
            {events.length === 0 && (
              <p className="py-4 text-xs text-muted-foreground">لا توجد أحداث مسجّلة بعد. ستظهر التحديثات هنا تلقائياً.</p>
            )}
          </ol>
        </Section>
      )}

      {tab === "notes" && (
        <Section title="ملاحظات داخلية" icon={FileText}>
          <p className="mb-3 text-[11px] text-muted-foreground">هذه الملاحظات للفريق فقط ولا يراها العميل.</p>

          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
              placeholder="اكتب ملاحظة..." rows={2}
              className="w-full rounded-md border border-border bg-background p-2 text-sm" />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={pinNew} onChange={(e) => setPinNew(e.target.checked)} />
                <Pin className="h-3 w-3" /> تثبيت كملاحظة حرجة
              </label>
              <button onClick={addNote} disabled={!newNote.trim()}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" /> إضافة
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {[...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).map((n, i) => {
              const realIdx = notes.indexOf(n);
              return (
                <div key={i} className={`flex items-start gap-2 rounded-lg border p-3 ${n.pinned ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border bg-card"}`}>
                  <div className="flex-1">
                    <p className="text-sm">{n.text}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {n.author} · {new Date(n.at).toLocaleString("ar")}
                    </p>
                  </div>
                  <button onClick={() => togglePin(realIdx)} title={n.pinned ? "إلغاء التثبيت" : "تثبيت"}
                    className={`rounded p-1.5 ${n.pinned ? "text-amber-700" : "text-muted-foreground hover:bg-muted"}`}>
                    <Pin className={`h-3.5 w-3.5 ${n.pinned ? "fill-current" : ""}`} />
                  </button>
                  <button onClick={() => removeNote(realIdx)} className="rounded p-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {notes.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">لا توجد ملاحظات</p>}
          </div>
        </Section>
      )}

      {/* Danger zone */}
      <div className="mt-6 rounded-xl border border-red-200/50 bg-red-50/30 p-4 dark:bg-red-950/10">
        <h3 className="mb-2 text-xs font-semibold text-red-900 dark:text-red-300">منطقة الخطر</h3>
        <button
          onClick={async () => {
            if (!confirm("إلغاء هذا الطلب؟ لا يمكن التراجع.")) return;
            await patch({ status: "cancelled" }, "order_cancelled");
          }}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:bg-transparent">
          إلغاء الطلب
        </button>
      </div>
    </AdminShell>
  );
}

function StatusCard({
  title, current, label, color, options, onChange,
}: {
  title: string; current: string; label: string; color: string;
  options: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{title}</span>
        <Pill label={label} color={color} />
      </div>
      <select value={current} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-border pt-2 text-base font-bold" : "text-xs"}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InlineEdit({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const dirty = v !== value;
  useEffect(() => setV(value), [value]);
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <input value={v} onChange={(e) => setV(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        {dirty && (
          <button onClick={() => onSave(v)} className="rounded-md bg-primary px-2 text-primary-foreground" title="حفظ">
            <Save className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </label>
  );
}

function TimelineItem({ icon, label, detail, at, actor }: { icon: string; label: string; detail?: string; at: string; actor?: string }) {
  return (
    <li className="relative">
      <span className="absolute -right-[1.4rem] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">{icon}</span>
      <div className="text-sm font-medium text-foreground">{label}</div>
      {detail && <div className="text-[11px] text-muted-foreground">{detail}</div>}
      <div className="text-[10px] text-muted-foreground">
        {new Date(at).toLocaleString("ar")}
        {actor && <> · بواسطة {actor}</>}
      </div>
    </li>
  );
}

function prettyAction(a: string): string {
  const map: Record<string, string> = {
    status_change: "تغيير حالة الطلب",
    payment_status_change: "تغيير حالة الدفع",
    shipping_status_change: "تغيير حالة الشحن",
    carrier_change: "تحديث شركة الشحن",
    tracking_update: "تحديث رقم التتبع",
    tracking_url_update: "تحديث رابط التتبع",
    note_added: "إضافة ملاحظة داخلية",
    bulk_status_change: "تغيير حالة جماعي",
    marked_reviewed: "تأشير: تمت المراجعة",
    order_cancelled: "إلغاء الطلب",
  };
  return map[a] ?? a;
}

function describeMeta(meta: any): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  const parts: string[] = [];
  if (meta.status) parts.push(`الطلب → ${ORDER_STATUS_LABEL[meta.status] ?? meta.status}`);
  if (meta.payment_status) parts.push(`الدفع → ${PAYMENT_STATUS_LABEL[meta.payment_status] ?? meta.payment_status}`);
  if (meta.shipping_status) parts.push(`الشحن → ${SHIPPING_STATUS_LABEL[meta.shipping_status] ?? meta.shipping_status}`);
  if (meta.shipping_carrier) parts.push(`شركة الشحن: ${meta.shipping_carrier}`);
  if (meta.tracking_number) parts.push(`رقم التتبع: ${meta.tracking_number}`);
  if (meta.to) parts.push(`→ ${ORDER_STATUS_LABEL[meta.to] ?? meta.to}`);
  return parts.join(" · ");
}

function OtoCreateShipmentButton({ orderId, hasTracking, onDone }: { orderId: string; hasTracking: boolean; onDone: () => void }) {
  const create = useServerFn(otoCreateShipment);
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    if (hasTracking && !confirm("الطلب يحتوي على رقم تتبع. إنشاء شحنة جديدة عبر OTO؟")) return;
    setLoading(true);
    try {
      const res: any = await create({ data: { orderId } });
      if (res?.ok) {
        toast.success("تم إنشاء الشحنة عبر OTO ✅");
        onDone();
      } else {
        toast.error(`فشل إنشاء الشحنة: ${res?.error || "خطأ غير معروف"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "فشل الاتصال بـ OTO");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={handleClick} disabled={loading}
      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      إنشاء شحنة عبر OTO
    </button>
  );
}
