import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/AuthContext";
import { sendMessage } from "@/lib/messaging";
import { AdminShell } from "@/components/AdminLayout";
import {
  MessageSquare, Send, Phone, Search, Settings as SettingsIcon, DollarSign,
  Plus, Trash2, Power, PowerOff, RefreshCw, Archive, CheckCircle, XCircle,
  Zap, Filter,
} from "lucide-react";

export const Route = createFileRoute("/admin/messages")({
  component: MessagesPage,
});

type Tab = "inbox" | "templates" | "providers" | "costs";

function MessagesPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  return (
    <AdminShell>
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">الرسائل · WhatsApp & SMS</h1>
        <p className="mt-1 text-sm text-muted-foreground">إدارة المحادثات، الردود السريعة، المزودين وتكلفة الرسائل.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { k: "inbox", label: "صندوق الوارد", icon: MessageSquare },
          { k: "templates", label: "الردود السريعة", icon: Zap },
          { k: "providers", label: "المزودون", icon: SettingsIcon },
          { k: "costs", label: "التكلفة", icon: DollarSign },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k as Tab)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${
                tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === "inbox" && <InboxTab />}
      {tab === "templates" && <QuickRepliesTab />}
      {tab === "providers" && <ProvidersTab />}
      {tab === "costs" && <CostsTab />}
    </div>
    </AdminShell>
  );
}

/* --------------------------------- Inbox --------------------------------- */
function InboxTab() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "archived">("open");
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp" | "sms">("all");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConvs = async () => {
    let q = supabase.from("messaging_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
    if (filter !== "all") q = q.eq("status", filter);
    if (channelFilter !== "all") q = q.eq("channel", channelFilter);
    const { data } = await q;
    setConvs(data || []);
  };

  const loadMessages = async (id: string) => {
    const { data } = await supabase.from("messaging_messages").select("*").eq("conversation_id", id).order("created_at");
    setMessages(data || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => { loadConvs(); }, [filter, channelFilter]);
  useEffect(() => {
    supabase.from("messaging_quick_replies").select("*").eq("is_enabled", true).order("sort_order").then(({ data }) => setQuickReplies(data || []));
  }, []);
  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("admin-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messaging_messages" }, () => {
        if (activeId) loadMessages(activeId);
        loadConvs();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messaging_conversations" }, () => loadConvs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  const active = convs.find(c => c.id === activeId);
  const visibleConvs = useMemo(() => {
    if (!search.trim()) return convs;
    const q = search.toLowerCase();
    return convs.filter(c =>
      (c.customer_name?.toLowerCase().includes(q)) ||
      c.customer_phone?.includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  }, [convs, search]);

  const send = async () => {
    if (!active || !body.trim()) return;
    setSending(true);
    const res = await sendMessage({
      channel: active.channel,
      phone: active.customer_phone,
      body,
      customer_user_id: active.customer_user_id,
      customer_name: active.customer_name,
      related_order_id: active.related_order_id,
      sent_by: user?.id,
      sent_by_email: user?.email,
    });
    setSending(false);
    if (res.ok) setBody("");
    else alert(res.error);
  };

  const setStatus = async (status: string) => {
    if (!active) return;
    await supabase.from("messaging_conversations").update({ status }).eq("id", active.id);
    loadConvs();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Conversations list */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3 space-y-2">
          <div className="flex gap-2">
            <button onClick={() => setNewOpen(true)} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:opacity-90">
              <Plus className="h-3 w-3" /> محادثة جديدة
            </button>
            <button onClick={loadConvs} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted" title="تحديث">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث..." className="w-full rounded-md border border-border bg-background py-1.5 pr-7 pl-2 text-xs" />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["open","resolved","archived","all"] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`rounded px-2 py-0.5 text-[10px] ${filter===s?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground"}`}>
                {s==="open"?"مفتوحة":s==="resolved"?"محلولة":s==="archived"?"مؤرشفة":"الكل"}
              </button>
            ))}
            {(["all","whatsapp","sms"] as const).map(c => (
              <button key={c} onClick={() => setChannelFilter(c)} className={`rounded px-2 py-0.5 text-[10px] ${channelFilter===c?"bg-secondary text-secondary-foreground":"bg-muted text-muted-foreground"}`}>
                {c==="all"?"جميع القنوات":c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {visibleConvs.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">لا توجد محادثات</p>}
          {visibleConvs.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-right hover:bg-muted ${activeId===c.id?"bg-muted":""}`}>
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-foreground">{c.customer_name || c.customer_phone}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] ${c.channel==="whatsapp"?"bg-green-500/10 text-green-600":"bg-blue-500/10 text-blue-600"}`}>{c.channel}</span>
              </div>
              <span className="truncate text-[11px] text-muted-foreground">{c.last_message_preview || "—"}</span>
              <span className="text-[10px] text-muted-foreground/70">{c.last_message_at ? new Date(c.last_message_at).toLocaleString("ar") : ""}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex min-h-[60vh] flex-col rounded-lg border border-border bg-card">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">اختر محادثة لعرضها</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="h-4 w-4" />{active.customer_name || active.customer_phone}
                </div>
                <p className="text-[11px] text-muted-foreground">{active.customer_phone} · {active.channel}</p>
              </div>
              <div className="flex gap-1">
                {active.status !== "resolved" && (
                  <button onClick={() => setStatus("resolved")} className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted" title="حل">
                    <CheckCircle className="h-3 w-3" />
                  </button>
                )}
                {active.status !== "archived" && (
                  <button onClick={() => setStatus("archived")} className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted" title="أرشفة">
                    <Archive className="h-3 w-3" />
                  </button>
                )}
                {active.status !== "open" && (
                  <button onClick={() => setStatus("open")} className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted" title="إعادة فتح">
                    إعادة فتح
                  </button>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-4">
              {messages.length === 0 && <p className="text-center text-xs text-muted-foreground">لا توجد رسائل</p>}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.direction==="outbound"?"justify-start":"justify-end"}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${m.direction==="outbound"?"bg-primary text-primary-foreground":"bg-card border border-border text-foreground"}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <div className="mt-1 flex items-center gap-1 text-[9px] opacity-70">
                      <span>{new Date(m.created_at).toLocaleString("ar")}</span>
                      {m.status === "failed" && <XCircle className="h-3 w-3 text-red-400" />}
                      {m.status === "sent" && <CheckCircle className="h-3 w-3" />}
                      {m.error_message && <span className="text-red-300">· {m.error_message}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t border-border px-3 py-2">
                {quickReplies.map(qr => (
                  <button key={qr.id} onClick={() => setBody(qr.body)} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted">
                    {qr.title}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 border-t border-border p-3">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="اكتب رسالة..."
                className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <button onClick={send} disabled={sending || !body.trim()}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <Send className="h-4 w-4" />{sending?"...":"إرسال"}
              </button>
            </div>
          </>
        )}
      </div>

      {newOpen && <NewConversationModal onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setActiveId(id); loadConvs(); }} />}
    </div>
  );
}

function NewConversationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!phone) return;
    setBusy(true);
    const { data, error } = await supabase.from("messaging_conversations").insert({
      customer_phone: phone.replace(/[^\d+]/g, ""),
      customer_name: name || null,
      channel, status: "open",
    }).select().single();
    setBusy(false);
    if (error) { alert(error.message); return; }
    onCreated(data!.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold">محادثة جديدة</h2>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل (اختياري)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665xxxxxxxx" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
          <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">إلغاء</button>
          <button onClick={create} disabled={busy || !phone} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">إنشاء</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Quick Replies ---------------------------- */
function QuickRepliesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("messaging_quick_replies").select("*").order("sort_order");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (editing.id) {
      await supabase.from("messaging_quick_replies").update({
        title: editing.title, body: editing.body, channel: editing.channel, is_enabled: editing.is_enabled, sort_order: editing.sort_order,
      }).eq("id", editing.id);
    } else {
      await supabase.from("messaging_quick_replies").insert({
        title: editing.title, body: editing.body, channel: editing.channel || "any", sort_order: editing.sort_order || 0,
      });
    }
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف؟")) return;
    await supabase.from("messaging_quick_replies").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ title: "", body: "", channel: "any", is_enabled: true, sort_order: items.length })}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> رد سريع جديد
        </button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr><th className="px-3 py-2 text-right">العنوان</th><th className="px-3 py-2 text-right">النص</th><th className="px-3 py-2 text-right">القناة</th><th className="px-3 py-2 text-right">الحالة</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.title}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1 max-w-md">{r.body}</td>
                <td className="px-3 py-2 text-xs">{r.channel}</td>
                <td className="px-3 py-2">{r.is_enabled ? <span className="text-green-600 text-xs">مفعّل</span> : <span className="text-muted-foreground text-xs">معطّل</span>}</td>
                <td className="px-3 py-2 text-left">
                  <button onClick={() => setEditing(r)} className="text-xs text-primary mr-2">تعديل</button>
                  <button onClick={() => remove(r.id)} className="text-xs text-red-500"><Trash2 className="inline h-3 w-3" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">لا توجد ردود سريعة</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-lg bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">{editing.id ? "تعديل" : "رد سريع جديد"}</h2>
            <div className="space-y-3">
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="العنوان" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={4} placeholder="النص — يدعم {{order_number}}, {{customer_name}}, {{tracking_number}}, {{payment_link}}" className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="any">أي قناة</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
                </select>
                <input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} placeholder="ترتيب" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
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

/* ------------------------------ Providers ------------------------------ */
function ProvidersTab() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("messaging_providers").select("*").order("channel").order("priority");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p: any) => {
    await supabase.from("messaging_providers").update({ is_enabled: !p.is_enabled }).eq("id", p.id);
    load();
  };

  const save = async () => {
    if (!editing) return;
    const payload: any = {
      name: editing.name, channel: editing.channel, provider_type: editing.provider_type,
      priority: editing.priority || 100, cost_per_message: editing.cost_per_message || 0,
      monthly_budget: editing.monthly_budget || null, config: editing.config || {},
      is_enabled: editing.is_enabled !== false,
    };
    if (editing.id) await supabase.from("messaging_providers").update(payload).eq("id", editing.id);
    else await supabase.from("messaging_providers").insert(payload);
    setEditing(null); load();
  };

  const resetSpend = async (id: string) => {
    await supabase.from("messaging_providers").update({ monthly_spend: 0, spend_reset_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ name: "", channel: "whatsapp", provider_type: "twilio", priority: 100, cost_per_message: 0, is_enabled: true, config: {} })}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> مزود جديد
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(p => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${p.channel==="whatsapp"?"bg-green-500/10 text-green-600":"bg-blue-500/10 text-blue-600"}`}>{p.channel}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">النوع: {p.provider_type} · أولوية: {p.priority}</p>
              </div>
              <button onClick={() => toggle(p)} className={`rounded p-1.5 ${p.is_enabled?"text-green-600":"text-muted-foreground"}`} title={p.is_enabled?"مفعّل":"معطّل"}>
                {p.is_enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted/50 p-2">
                <p className="text-[10px] text-muted-foreground">تكلفة/رسالة</p>
                <p className="font-semibold">{Number(p.cost_per_message || 0).toFixed(4)}</p>
              </div>
              <div className="rounded bg-muted/50 p-2">
                <p className="text-[10px] text-muted-foreground">المنصرف الشهري</p>
                <p className="font-semibold">{Number(p.monthly_spend || 0).toFixed(2)} {p.monthly_budget ? `/ ${p.monthly_budget}` : ""}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing(p)} className="flex-1 rounded border border-border py-1.5 text-xs hover:bg-muted">تعديل</button>
              <button onClick={() => resetSpend(p.id)} className="rounded border border-border px-2 py-1.5 text-xs hover:bg-muted" title="إعادة عداد المنصرف"><RefreshCw className="h-3 w-3" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-lg bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">{editing.id ? "تعديل مزود" : "مزود جديد"}</h2>
            <div className="grid gap-3">
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="الاسم" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
                </select>
                <select value={editing.provider_type} onChange={(e) => setEditing({ ...editing, provider_type: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="twilio">Twilio</option>
                  <option value="unifonic">Unifonic</option>
                  <option value="wa_link">WhatsApp Web Link (يدوي)</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={editing.priority || 100} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })} placeholder="الأولوية (الأقل أولاً)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <input type="number" step="0.0001" value={editing.cost_per_message || 0} onChange={(e) => setEditing({ ...editing, cost_per_message: Number(e.target.value) })} placeholder="تكلفة/رسالة" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <input type="number" step="0.01" value={editing.monthly_budget || ""} onChange={(e) => setEditing({ ...editing, monthly_budget: e.target.value ? Number(e.target.value) : null })} placeholder="ميزانية شهرية" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <textarea value={JSON.stringify(editing.config || {}, null, 2)} onChange={(e) => { try { setEditing({ ...editing, config: JSON.parse(e.target.value) }); } catch {} }} rows={5} placeholder='{"from":"+1...","api_key":"..."}' className="rounded-md border border-border bg-background px-3 py-2 text-xs font-mono" dir="ltr" />
              <p className="text-[10px] text-muted-foreground">المفاتيح الحقيقية تُحفظ في الأسرار (Secrets) من قسم التكاملات. الحقل JSON هنا للإعدادات غير الحساسة فقط.</p>
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

/* -------------------------------- Costs -------------------------------- */
function CostsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("messaging_costs_log").select("*").order("day", { ascending: false }).limit(100).then(({ data }) => setRows(data || []));
    supabase.from("messaging_providers").select("*").then(({ data }) => setProviders(data || []));
  }, []);

  const totalSpend = providers.reduce((s, p) => s + Number(p.monthly_spend || 0), 0);
  const totalMessages = rows.reduce((s, r) => s + (r.message_count || 0), 0);
  const providerName = (id: string) => providers.find(p => p.id === id)?.name || "—";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">المنصرف الشهري الكلي</p>
          <p className="mt-1 text-2xl font-semibold">{totalSpend.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">رسائل (آخر 100 يوم)</p>
          <p className="mt-1 text-2xl font-semibold">{totalMessages}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">عدد المزودين المفعّلين</p>
          <p className="mt-1 text-2xl font-semibold">{providers.filter(p => p.is_enabled).length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-right">اليوم</th>
              <th className="px-3 py-2 text-right">المزود</th>
              <th className="px-3 py-2 text-right">القناة</th>
              <th className="px-3 py-2 text-right">عدد الرسائل</th>
              <th className="px-3 py-2 text-right">التكلفة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{r.day}</td>
                <td className="px-3 py-2">{providerName(r.provider_id)}</td>
                <td className="px-3 py-2 text-xs">{r.channel}</td>
                <td className="px-3 py-2">{r.message_count}</td>
                <td className="px-3 py-2 font-medium">{Number(r.total_cost).toFixed(4)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">لا يوجد سجل تكلفة بعد</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
