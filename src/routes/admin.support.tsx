import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/AuthContext";
import { AdminShell } from "@/components/AdminLayout";
import {
  MessageSquare, Send, Search, Filter, RefreshCw, Lock,
  CheckCircle, Archive, AlertCircle, User as UserIcon, Tag,
  Plus, Trash2, Star, FileText, Mail,
} from "lucide-react";

export const Route = createFileRoute("/admin/support")({
  component: SupportPage,
});

type Tab = "tickets" | "contact" | "canned" | "faq";

function SupportPage() {
  const [tab, setTab] = useState<Tab>("tickets");

  return (
    <AdminShell>
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">خدمة العملاء</h1>
        <p className="mt-1 text-sm text-muted-foreground">إدارة التذاكر، رسائل التواصل، الردود الجاهزة والأسئلة الشائعة.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { k: "tickets", label: "التذاكر", icon: MessageSquare },
          { k: "contact", label: "رسائل التواصل", icon: Mail },
          { k: "canned", label: "الردود الجاهزة", icon: FileText },
          { k: "faq", label: "الأسئلة الشائعة", icon: AlertCircle },
        ].map(t => {
          const Icon = t.icon as any;
          return (
            <button key={t.k} onClick={() => setTab(t.k as Tab)} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${tab===t.k?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === "tickets" && <TicketsTab />}
      {tab === "contact" && <ContactTab />}
      {tab === "canned" && <CannedTab />}
      {tab === "faq" && <FaqTab />}
    </div>
    </AdminShell>
  );
}

/* ------------------------------ Tickets ------------------------------ */
const STATUS_LABELS: Record<string, string> = {
  new: "جديدة", open: "مفتوحة", waiting_customer: "بانتظار العميل",
  waiting_admin: "بانتظار الإدارة", resolved: "محلولة", closed: "مغلقة",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600", open: "bg-amber-500/10 text-amber-600",
  waiting_customer: "bg-purple-500/10 text-purple-600", waiting_admin: "bg-orange-500/10 text-orange-600",
  resolved: "bg-green-500/10 text-green-600", closed: "bg-muted text-muted-foreground",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground", normal: "text-foreground", high: "text-amber-600", urgent: "text-red-600 font-bold",
};
const CATEGORY_LABELS: Record<string, string> = {
  order_inquiry: "استفسار طلب", payment_issue: "مشكلة دفع", shipping_issue: "مشكلة شحن",
  return: "استرجاع", damaged_product: "منتج تالف", general: "عام", other: "أخرى",
};

function TicketsTab() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [canned, setCanned] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    let q = supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (assignedFilter === "me" && user?.id) q = q.eq("assigned_to", user.id);
    else if (assignedFilter === "unassigned") q = q.is("assigned_to", null);
    const { data } = await q;
    setTickets(data || []);
  };

  const loadMessages = async (id: string) => {
    const { data } = await supabase.from("support_ticket_messages").select("*").eq("ticket_id", id).order("created_at");
    setMessages(data || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    const { data: r } = await supabase.from("support_ticket_ratings").select("*").eq("ticket_id", id).maybeSingle();
    setRating(r);
  };

  useEffect(() => { load(); }, [statusFilter, assignedFilter]);
  useEffect(() => {
    supabase.from("support_canned_replies").select("*").eq("is_enabled", true).order("sort_order").then(({ data }) => setCanned(data || []));
    supabase.from("profiles").select("user_id,full_name,email").limit(50).then(({ data }) => setStaff(data || []));
  }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);

  // realtime
  useEffect(() => {
    const ch = supabase.channel("support-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_ticket_messages" }, () => { if (activeId) loadMessages(activeId); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, statusFilter, assignedFilter]);

  const active = tickets.find(t => t.id === activeId);
  const filtered = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(t => t.subject?.toLowerCase().includes(q) || t.ticket_number?.toLowerCase().includes(q) || t.customer_email?.toLowerCase().includes(q) || t.customer_name?.toLowerCase().includes(q));
  }, [tickets, search]);

  const send = async () => {
    if (!active || !body.trim()) return;
    setSending(true);
    await supabase.from("support_ticket_messages").insert({
      ticket_id: active.id, body, direction: internalNote ? "staff" : "staff",
      is_internal_note: internalNote,
      author_id: user?.id, author_email: user?.email, author_name: user?.email?.split("@")[0],
    });
    setBody(""); setInternalNote(false); setSending(false);
  };

  const updateTicket = async (patch: any) => {
    if (!active) return;
    await supabase.from("support_tickets").update(patch).eq("id", active.id);
    load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم/عنوان/عميل" className="w-full rounded-md border border-border bg-background py-1.5 pr-7 pl-2 text-xs" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
            <option value="all">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
            <option value="all">كل الموظفين</option>
            <option value="me">المسندة لي</option>
            <option value="unassigned">غير مسندة</option>
          </select>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {filtered.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">لا توجد تذاكر</p>}
          {filtered.map(t => (
            <button key={t.id} onClick={() => setActiveId(t.id)} className={`flex w-full flex-col items-start gap-1 border-b border-border px-3 py-2.5 text-right hover:bg-muted ${activeId===t.id?"bg-muted":""}`}>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.subject}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
              </div>
              <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">{t.ticket_number}</span>
                <span>{CATEGORY_LABELS[t.category]}</span>
              </div>
              <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate">{t.customer_name || t.customer_email}</span>
                {t.priority !== "normal" && <span className={PRIORITY_COLORS[t.priority]}>{t.priority}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ticket detail */}
      <div className="flex min-h-[65vh] flex-col rounded-lg border border-border bg-card">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">اختر تذكرة لعرضها</div>
        ) : (
          <>
            <div className="border-b border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">{active.subject}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{active.ticket_number}</span>
                    <span>·</span>
                    <span>{active.customer_name} ({active.customer_email})</span>
                    {active.related_order_number && <><span>·</span><span>طلب: {active.related_order_number}</span></>}
                  </div>
                  {rating && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? "fill-current" : ""}`} />)}
                      {rating.comment && <span className="ml-2 text-muted-foreground">"{rating.comment}"</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <select value={active.status} onChange={(e) => updateTicket({ status: e.target.value, closed_at: ["resolved","closed"].includes(e.target.value) ? new Date().toISOString() : null })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={active.priority} onChange={(e) => updateTicket({ priority: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  <option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option>
                </select>
                <select value={active.category} onChange={(e) => updateTicket({ category: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={active.assigned_to || ""} onChange={(e) => updateTicket({ assigned_to: e.target.value || null })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  <option value="">غير مسند</option>
                  {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
                </select>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.direction==="staff"?"justify-start":"justify-end"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.is_internal_note ? "bg-amber-500/10 border border-amber-500/30 text-foreground" :
                    m.direction === "staff" ? "bg-primary text-primary-foreground" :
                    "bg-card border border-border text-foreground"
                  }`}>
                    {m.is_internal_note && <p className="mb-1 text-[10px] font-bold text-amber-600">📝 ملاحظة داخلية</p>}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-[9px] opacity-70">{m.author_name || m.author_email} · {new Date(m.created_at).toLocaleString("ar")}</p>
                  </div>
                </div>
              ))}
            </div>

            {canned.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t border-border px-3 py-2">
                {canned.slice(0, 8).map(c => (
                  <button key={c.id} onClick={() => setBody(c.body)} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted">
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border p-3">
              <label className="mb-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                ملاحظة داخلية (لا يراها العميل)
              </label>
              <div className="flex gap-2">
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={3000}
                  placeholder={internalNote ? "اكتب ملاحظة داخلية..." : "اكتب رد للعميل..."}
                  className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <button onClick={send} disabled={sending || !body.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Send className="h-4 w-4" />{sending?"...":"إرسال"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Contact Submissions --------------------------- */
function ContactTab() {
  const [items, setItems] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    let q = supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setItems(data || []);
  };
  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("contact_submissions").update({ status }).eq("id", id); load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
            <option value="all">الكل</option><option value="new">جديدة</option><option value="read">مقروءة</option><option value="replied">تم الرد</option><option value="archived">مؤرشفة</option>
          </select>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {items.map(it => (
            <button key={it.id} onClick={() => { setActive(it); if (it.status==="new") setStatus(it.id, "read"); }} className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-right hover:bg-muted ${active?.id===it.id?"bg-muted":""}`}>
              <div className="flex w-full justify-between"><span className="text-sm font-medium">{it.name}</span>{it.status==="new" && <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-600">جديد</span>}</div>
              <span className="text-[11px] text-muted-foreground line-clamp-1">{it.subject || it.message}</span>
              <span className="text-[10px] text-muted-foreground/70">{new Date(it.created_at).toLocaleString("ar")}</span>
            </button>
          ))}
          {items.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">لا توجد رسائل</p>}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        {!active ? <p className="text-center text-sm text-muted-foreground py-20">اختر رسالة</p> : (
          <>
            <h3 className="text-base font-semibold">{active.subject || "(بدون موضوع)"}</h3>
            <div className="mt-1 text-xs text-muted-foreground">من: {active.name} ({active.email}) {active.phone && `· ${active.phone}`}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{new Date(active.created_at).toLocaleString("ar")}</div>
            <div className="mt-4 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{active.message}</div>
            <div className="mt-4 flex gap-2">
              <a href={`mailto:${active.email}?subject=${encodeURIComponent("رد: " + (active.subject || ""))}`} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">رد بالبريد</a>
              <button onClick={() => setStatus(active.id, "replied")} className="rounded-md border border-border px-3 py-1.5 text-xs">تعليم تم الرد</button>
              <button onClick={() => { setStatus(active.id, "archived"); setActive(null); }} className="rounded-md border border-border px-3 py-1.5 text-xs">أرشفة</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Canned ------------------------------ */
function CannedTab() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("support_canned_replies").select("*").order("sort_order");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (editing.id) await supabase.from("support_canned_replies").update({
      title: editing.title, body: editing.body, category: editing.category, is_enabled: editing.is_enabled, sort_order: editing.sort_order || 0,
    }).eq("id", editing.id);
    else await supabase.from("support_canned_replies").insert({
      title: editing.title, body: editing.body, category: editing.category, sort_order: editing.sort_order || 0,
    });
    setEditing(null); load();
  };
  const del = async (id: string) => { if (confirm("حذف؟")) { await supabase.from("support_canned_replies").delete().eq("id", id); load(); } };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ title: "", body: "", category: "general", is_enabled: true })} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><Plus className="h-3.5 w-3.5" /> رد جديد</button>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-right">العنوان</th><th className="px-3 py-2 text-right">الفئة</th><th className="px-3 py-2 text-right">النص</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.title}</td>
                <td className="px-3 py-2 text-xs">{r.category || "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1 max-w-md">{r.body}</td>
                <td className="px-3 py-2 text-left">
                  <button onClick={() => setEditing(r)} className="text-xs text-primary mr-2">تعديل</button>
                  <button onClick={() => del(r.id)} className="text-xs text-red-500"><Trash2 className="inline h-3 w-3" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">لا توجد ردود</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-lg bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">{editing.id ? "تعديل" : "رد جديد"}</h2>
            <div className="space-y-3">
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="العنوان" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={5} placeholder="النص — يدعم {{order_number}}, {{customer_name}}" className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="الفئة (اختياري)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 text-sm">إلغاء</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- FAQ -------------------------------- */
function FaqTab() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("faq_items").select("*").order("category").order("sort_order");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = {
      category: editing.category, question_ar: editing.question_ar, answer_ar: editing.answer_ar,
      question_en: editing.question_en || null, answer_en: editing.answer_en || null,
      sort_order: editing.sort_order || 0, is_enabled: editing.is_enabled !== false,
    };
    if (editing.id) await supabase.from("faq_items").update(payload).eq("id", editing.id);
    else await supabase.from("faq_items").insert(payload);
    setEditing(null); load();
  };
  const del = async (id: string) => { if (confirm("حذف؟")) { await supabase.from("faq_items").delete().eq("id", id); load(); } };
  const toggle = async (it: any) => { await supabase.from("faq_items").update({ is_enabled: !it.is_enabled }).eq("id", it.id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ category: "general", question_ar: "", answer_ar: "", is_enabled: true })} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><Plus className="h-3.5 w-3.5" /> سؤال جديد</button>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-right">الفئة</th><th className="px-3 py-2 text-right">السؤال</th><th className="px-3 py-2 text-right">الحالة</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs">{it.category}</td>
                <td className="px-3 py-2 font-medium">{it.question_ar}</td>
                <td className="px-3 py-2"><button onClick={() => toggle(it)} className={`text-xs ${it.is_enabled?"text-green-600":"text-muted-foreground"}`}>{it.is_enabled?"مفعّل":"معطّل"}</button></td>
                <td className="px-3 py-2 text-left">
                  <button onClick={() => setEditing(it)} className="text-xs text-primary mr-2">تعديل</button>
                  <button onClick={() => del(it.id)} className="text-xs text-red-500"><Trash2 className="inline h-3 w-3" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">لا توجد أسئلة</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-lg bg-card p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">{editing.id ? "تعديل سؤال" : "سؤال جديد"}</h2>
            <div className="space-y-3">
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="general">عام</option><option value="orders">الطلبات</option><option value="payment">الدفع</option><option value="shipping">الشحن</option><option value="returns">الإرجاع</option><option value="account">الحساب</option>
              </select>
              <input value={editing.question_ar} onChange={(e) => setEditing({ ...editing, question_ar: e.target.value })} placeholder="السؤال (عربي)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <textarea value={editing.answer_ar} onChange={(e) => setEditing({ ...editing, answer_ar: e.target.value })} rows={4} placeholder="الجواب (عربي)" className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input value={editing.question_en || ""} onChange={(e) => setEditing({ ...editing, question_en: e.target.value })} placeholder="Question (English) — optional" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
              <textarea value={editing.answer_en || ""} onChange={(e) => setEditing({ ...editing, answer_en: e.target.value })} rows={3} placeholder="Answer (English) — optional" className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
              <input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} placeholder="ترتيب" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_enabled !== false} onChange={(e) => setEditing({ ...editing, is_enabled: e.target.checked })} /> مفعّل</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 text-sm">إلغاء</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
