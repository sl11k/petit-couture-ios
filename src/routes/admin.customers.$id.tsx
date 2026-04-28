import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ArrowRight, MessageCircle, Mail, Phone, Plus, Save, Ban, CheckCircle,
  AlertTriangle, ShoppingCart, Heart, ShoppingBag, Star, Pin, MapPin, Download,
} from "lucide-react";

export const Route = createFileRoute("/admin/customers/$id")({
  component: CustomerDetail,
});

type Profile = {
  id: string; user_id: string;
  full_name: string | null; email: string | null; phone: string | null;
  city: string | null; status: string; source: string; tag: string | null;
  loyalty_points: number; internal_notes: any[]; last_contact_at: string | null;
  created_at: string;
};

type Order = {
  id: string; order_number: string; status: string; payment_status: string;
  total: number; created_at: string; shipping_address: any;
};

type Comm = {
  id: string; channel: string; direction: string;
  subject: string | null; body: string | null;
  actor_email: string | null; created_at: string;
};

type Wish = { item_id: string; created_at: string };
type Cart = { id: string; subtotal: number; items: any[]; updated_at: string; converted: boolean };

const statusLabel: Record<string, string> = {
  active: "نشط", blocked: "محظور", needs_review: "يحتاج مراجعة",
};
const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-700",
  needs_review: "bg-yellow-100 text-yellow-800",
};

function CustomerDetail() {
  const { id: userId } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, isManager, canManage, canEditOrders } = useUserRole();
  const canExport = isAdmin || isManager;

  const [tab, setTab] = useState<"overview" | "orders" | "addresses" | "wishlist" | "carts" | "comm" | "notes">("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [wishlist, setWishlist] = useState<Wish[]>([]);
  const [comms, setComms] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});

  // Note
  const [newNote, setNewNote] = useState("");
  const [pinNote, setPinNote] = useState(false);

  // Communication
  const [commForm, setCommForm] = useState({ channel: "whatsapp", subject: "", body: "" });

  async function load() {
    setLoading(true);
    const { data: p } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (p) {
      setProfile(p as Profile);
      setEditForm(p as Profile);
    }
    const { data: o } = await supabase
      .from("orders").select("id, order_number, status, payment_status, total, created_at, shipping_address")
      .eq("user_id", userId).order("created_at", { ascending: false });
    setOrders((o ?? []) as Order[]);

    const { data: c } = await supabase
      .from("abandoned_carts").select("*").eq("user_id", userId)
      .order("updated_at", { ascending: false });
    setCarts((c ?? []) as Cart[]);

    const { data: w } = await supabase
      .from("wishlist_items").select("*").eq("user_id", userId);
    setWishlist((w ?? []) as Wish[]);

    const { data: cm } = await supabase
      .from("customer_communications").select("*")
      .eq("customer_user_id", userId).order("created_at", { ascending: false });
    setComms((cm ?? []) as Comm[]);

    setLoading(false);
  }
  useEffect(() => { void load(); }, [userId]);

  // ============ Derived stats ============
  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status !== "cancelled");
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const refunded = orders.filter((o) => o.payment_status?.includes("refund")).length;
    const total = completed.reduce((s, o) => s + Number(o.total), 0);
    const aov = completed.length > 0 ? total / completed.length : 0;
    return {
      orderCount: completed.length, ltv: total, aov, cancelled, refunded,
      lastOrder: orders[0]?.created_at ?? null,
    };
  }, [orders]);

  // ============ Addresses (from order history) ============
  const addresses = useMemo(() => {
    const seen = new Map<string, any>();
    orders.forEach((o) => {
      const a = o.shipping_address ?? {};
      const key = `${a.city ?? ""}|${a.address ?? a.street ?? ""}|${a.postal_code ?? ""}`;
      if (!seen.has(key) && (a.address || a.city)) seen.set(key, { ...a, last_used: o.created_at });
    });
    return Array.from(seen.values());
  }, [orders]);

  if (loading) return <AdminShell><p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p></AdminShell>;
  if (!profile) return <AdminShell><p className="p-6 text-center text-sm">العميل غير موجود</p></AdminShell>;

  // ============ Actions ============
  async function logAudit(action: string, metadata: any = {}) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("audit_logs").insert({
      actor_id: u.user.id, actor_email: u.user.email,
      action, entity: "customer", entity_id: userId, metadata,
    });
  }

  async function setStatus(status: string) {
    if (!canManage) return alert("لا تملك صلاحية");
    if (status === "blocked" && !confirm("حظر هذا العميل؟")) return;
    await supabase.from("profiles").update({ status }).eq("user_id", userId);
    await logAudit(`customer.${status}`, { previous: profile!.status });
    await load();
  }

  async function saveProfile() {
    if (!canManage) return alert("لا تملك صلاحية تعديل البيانات");
    const payload = {
      full_name: editForm.full_name, email: editForm.email, phone: editForm.phone,
      city: editForm.city, source: editForm.source, tag: editForm.tag,
      loyalty_points: Number(editForm.loyalty_points ?? 0),
    };
    await supabase.from("profiles").update(payload).eq("user_id", userId);
    await logAudit("customer.update", { fields: Object.keys(payload) });
    setEditing(false);
    await load();
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const note = {
      id: crypto.randomUUID(), text: newNote.trim(), pinned: pinNote,
      author: u.user?.email ?? "system", at: new Date().toISOString(),
    };
    const updated = [...(profile!.internal_notes ?? []), note];
    await supabase.from("profiles").update({ internal_notes: updated }).eq("user_id", userId);
    await logAudit("customer.note_added", { pinned: pinNote });
    setNewNote(""); setPinNote(false);
    await load();
  }

  async function logComm() {
    if (!commForm.body.trim()) return alert("اكتب نص الرسالة");
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("customer_communications").insert({
      customer_user_id: userId, channel: commForm.channel, direction: "outbound",
      subject: commForm.subject || null, body: commForm.body,
      actor_id: u.user?.id, actor_email: u.user?.email,
    });
    await supabase.from("profiles").update({ last_contact_at: new Date().toISOString() }).eq("user_id", userId);
    await logAudit("customer.communication", { channel: commForm.channel });
    setCommForm({ channel: "whatsapp", subject: "", body: "" });
    await load();
  }

  function exportCustomer() {
    if (!canExport) return alert("التصدير للإدمن/المدير فقط");
    const data = { profile, stats, orders, addresses, wishlist, carts, communications: comms };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customer-${profile!.full_name || profile!.user_id}.json`;
    a.click();
  }

  const phoneDigits = profile.phone?.replace(/\D/g, "") ?? "";

  return (
    <AdminShell>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/admin/customers" })} className="rounded p-1.5 hover:bg-muted">
          <ArrowRight className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-semibold">{profile.full_name || profile.email || "عميل"}</h1>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusColor[profile.status] ?? ""}`}>
          {statusLabel[profile.status] ?? profile.status}
        </span>
        {profile.tag && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{profile.tag}</span>}
      </div>

      {/* Quick action bar */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link to="/admin/create-order"
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <ShoppingCart className="h-3.5 w-3.5" /> إنشاء طلب
        </Link>
        {phoneDigits && (
          <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white">
            <MessageCircle className="h-3.5 w-3.5" /> واتساب
          </a>
        )}
        {profile.phone && (
          <a href={`tel:${profile.phone}`}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs">
            <Phone className="h-3.5 w-3.5" /> اتصال
          </a>
        )}
        {profile.email && (
          <a href={`mailto:${profile.email}`}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> إيميل
          </a>
        )}
        {canManage && profile.status !== "blocked" && (
          <button onClick={() => setStatus("blocked")}
            className="flex items-center gap-1 rounded-md border border-destructive px-3 py-1.5 text-xs text-destructive">
            <Ban className="h-3.5 w-3.5" /> حظر
          </button>
        )}
        {canManage && profile.status === "blocked" && (
          <button onClick={() => setStatus("active")}
            className="flex items-center gap-1 rounded-md border border-green-600 px-3 py-1.5 text-xs text-green-700">
            <CheckCircle className="h-3.5 w-3.5" /> إلغاء الحظر
          </button>
        )}
        {canManage && profile.status !== "needs_review" && (
          <button onClick={() => setStatus("needs_review")}
            className="flex items-center gap-1 rounded-md border border-yellow-600 px-3 py-1.5 text-xs text-yellow-700">
            <AlertTriangle className="h-3.5 w-3.5" /> يحتاج مراجعة
          </button>
        )}
        <button onClick={exportCustomer} disabled={!canExport}
          className="ml-auto flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> تصدير البيانات
        </button>
      </div>

      {/* KPI Cards */}
      <div className="mb-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="LTV" value={`${stats.ltv.toFixed(0)} ر.س`} icon={<ShoppingBag className="h-4 w-4" />} />
        <Kpi label="عدد الطلبات" value={String(stats.orderCount)} icon={<ShoppingCart className="h-4 w-4" />} />
        <Kpi label="متوسط الطلب" value={`${stats.aov.toFixed(0)} ر.س`} icon={<Star className="h-4 w-4" />} />
        <Kpi label="ملغاة" value={String(stats.cancelled)} icon={<Ban className="h-4 w-4" />} />
        <Kpi label="مرتجعات" value={String(stats.refunded)} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi label="نقاط الولاء" value={String(profile.loyalty_points)} icon={<Star className="h-4 w-4 text-yellow-500" />} />
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-md bg-card p-1 text-xs">
        {([
          ["overview", "نظرة عامة"], ["orders", `الطلبات (${orders.length})`],
          ["addresses", `العناوين (${addresses.length})`], ["wishlist", `المفضلة (${wishlist.length})`],
          ["carts", `سلات متروكة (${carts.filter((c) => !c.converted).length})`],
          ["comm", `سجل التواصل (${comms.length})`],
          ["notes", `ملاحظات (${(profile.internal_notes ?? []).length})`],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`whitespace-nowrap rounded px-3 py-1.5 ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="rounded-xl border border-border bg-card p-4">
          {!editing ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">بيانات العميل</h2>
                {canManage && (
                  <button onClick={() => setEditing(true)}
                    className="rounded-md border border-border px-3 py-1 text-xs">تعديل</button>
                )}
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info label="الاسم">{profile.full_name || "—"}</Info>
                <Info label="الإيميل">{profile.email || "—"}</Info>
                <Info label="الجوال">{profile.phone || "—"}</Info>
                <Info label="المدينة">{profile.city || "—"}</Info>
                <Info label="المصدر">{profile.source}</Info>
                <Info label="التصنيف">{profile.tag || "—"}</Info>
                <Info label="آخر تواصل">{profile.last_contact_at ? new Date(profile.last_contact_at).toLocaleString("ar") : "—"}</Info>
                <Info label="تاريخ التسجيل">{new Date(profile.created_at).toLocaleString("ar")}</Info>
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-3 text-sm font-semibold">تعديل البيانات</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="الاسم"><input value={editForm.full_name ?? ""} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="input-base" /></Field>
                <Field label="الإيميل"><input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-base" /></Field>
                <Field label="الجوال"><input value={editForm.phone ?? ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-base" /></Field>
                <Field label="المدينة"><input value={editForm.city ?? ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="input-base" /></Field>
                <Field label="المصدر">
                  <select value={editForm.source ?? "web"} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="input-base">
                    <option value="web">الموقع</option><option value="whatsapp">واتساب</option>
                    <option value="campaign">حملة</option><option value="manual">طلب يدوي</option>
                  </select>
                </Field>
                <Field label="التصنيف (VIP, جملة, ...)"><input value={editForm.tag ?? ""} onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })} className="input-base" /></Field>
                <Field label="نقاط الولاء"><input type="number" value={editForm.loyalty_points ?? 0} onChange={(e) => setEditForm({ ...editForm, loyalty_points: Number(e.target.value) })} className="input-base" /></Field>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={saveProfile} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                  <Save className="h-3.5 w-3.5" /> حفظ
                </button>
                <button onClick={() => { setEditing(false); setEditForm(profile!); }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs">إلغاء</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ORDERS */}
      {tab === "orders" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr><th className="p-3">الرقم</th><th className="p-3">التاريخ</th><th className="p-3">الحالة</th><th className="p-3">الدفع</th><th className="p-3 text-center">الإجمالي</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3 font-mono text-xs">{o.order_number}</td>
                  <td className="p-3 text-xs">{new Date(o.created_at).toLocaleDateString("ar")}</td>
                  <td className="p-3 text-xs">{o.status}</td>
                  <td className="p-3 text-xs">{o.payment_status}</td>
                  <td className="p-3 text-center font-semibold">{Number(o.total).toFixed(0)}</td>
                  <td className="p-3"><Link to="/admin/orders/$id" params={{ id: o.id }} className="text-xs text-primary hover:underline">عرض</Link></td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">لا طلبات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ADDRESSES */}
      {tab === "addresses" && (
        <div className="grid gap-2 md:grid-cols-2">
          {addresses.map((a, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {a.city || "—"}
              </div>
              <div className="text-xs text-muted-foreground">{a.address || a.street || "—"}</div>
              {a.postal_code && <div className="text-[11px] text-muted-foreground">رمز بريدي: {a.postal_code}</div>}
              <div className="mt-1 text-[10px] text-muted-foreground">آخر استخدام: {new Date(a.last_used).toLocaleDateString("ar")}</div>
            </div>
          ))}
          {addresses.length === 0 && <p className="md:col-span-2 rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">لا عناوين مسجلة</p>}
        </div>
      )}

      {/* WISHLIST */}
      {tab === "wishlist" && (
        <div className="rounded-xl border border-border bg-card p-4">
          {wishlist.length === 0 ? <p className="text-center text-xs text-muted-foreground">لا توجد منتجات مفضلة</p> : (
            <ul className="grid gap-2 md:grid-cols-2">
              {wishlist.map((w) => (
                <li key={w.item_id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <Heart className="h-3.5 w-3.5 text-red-500" />
                  <span className="font-mono text-xs">{w.item_id}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("ar")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* CARTS */}
      {tab === "carts" && (
        <div className="space-y-2">
          {carts.map((c) => (
            <div key={c.id} className={`rounded-xl border p-3 ${c.converted ? "border-green-200 bg-green-50/30" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between text-xs">
                <span>{c.converted ? "✅ تحوّلت إلى طلب" : "🛒 سلة متروكة"}</span>
                <span className="text-muted-foreground">{new Date(c.updated_at).toLocaleString("ar")}</span>
              </div>
              <div className="mt-1 text-sm font-semibold">{Number(c.subtotal).toFixed(0)} ر.س — {(c.items ?? []).length} منتج</div>
            </div>
          ))}
          {carts.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">لا سلات</p>}
        </div>
      )}

      {/* COMMUNICATIONS */}
      {tab === "comm" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <h3 className="mb-2 text-xs font-semibold">تسجيل تواصل جديد</h3>
            <div className="grid gap-2 md:grid-cols-3">
              <select value={commForm.channel} onChange={(e) => setCommForm({ ...commForm, channel: e.target.value })} className="input-base">
                <option value="whatsapp">واتساب</option><option value="sms">SMS</option>
                <option value="email">إيميل</option><option value="call">مكالمة</option>
                <option value="note">ملاحظة</option>
              </select>
              <input placeholder="الموضوع (اختياري)" value={commForm.subject}
                onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} className="input-base md:col-span-2" />
              <textarea placeholder="نص الرسالة..." value={commForm.body}
                onChange={(e) => setCommForm({ ...commForm, body: e.target.value })}
                rows={2} className="input-base md:col-span-3" />
            </div>
            <button onClick={logComm} className="mt-2 flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> حفظ التواصل
            </button>
          </div>
          {comms.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold">{channelLabel(c.channel)} · {c.direction === "inbound" ? "وارد" : "صادر"}</span>
                <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</span>
              </div>
              {c.subject && <div className="text-xs font-medium">{c.subject}</div>}
              {c.body && <div className="mt-1 whitespace-pre-wrap text-sm">{c.body}</div>}
              {c.actor_email && <div className="mt-1 text-[10px] text-muted-foreground">— {c.actor_email}</div>}
            </div>
          ))}
          {comms.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">لا سجلات تواصل</p>}
        </div>
      )}

      {/* NOTES */}
      {tab === "notes" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3}
              placeholder="أضف ملاحظة داخلية..." className="input-base" />
            <div className="mt-2 flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={pinNote} onChange={(e) => setPinNote(e.target.checked)} /> تثبيت
              </label>
              <button onClick={addNote} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                <Plus className="h-3.5 w-3.5" /> إضافة
              </button>
            </div>
          </div>
          {[...(profile.internal_notes ?? [])].sort((a: any, b: any) => Number(b.pinned) - Number(a.pinned)).map((n: any) => (
            <div key={n.id} className={`rounded-xl border p-3 ${n.pinned ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">
                  {n.pinned && <Pin className="inline h-3 w-3 text-primary" />} {n.author}
                </span>
                <span className="text-muted-foreground">{new Date(n.at).toLocaleString("ar")}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.text}</p>
            </div>
          ))}
          {(profile.internal_notes ?? []).length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">لا ملاحظات</p>
          )}
        </div>
      )}

      <style>{`.input-base{width:100%;border-radius:0.375rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input-base:focus{box-shadow:0 0 0 1px hsl(var(--primary))}`}</style>
    </AdminShell>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function channelLabel(c: string) {
  return ({ whatsapp: "واتساب", sms: "SMS", email: "إيميل", call: "مكالمة", note: "ملاحظة" } as Record<string, string>)[c] ?? c;
}
