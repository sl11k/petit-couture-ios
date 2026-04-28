import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/state/AuthContext";
import { toast } from "sonner";
import { notify, renderTemplate, retryNotification, type NotificationChannel } from "@/lib/notifications";
import {
  Bell, Mail, MessageCircle, Smartphone, Inbox, Settings as SettingsIcon, FileText,
  RefreshCw, CheckCircle2, XCircle, Clock, Send, Eye, Edit3, Search, AlertTriangle,
  ToggleLeft, ToggleRight,
} from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({ component: NotificationsPage });

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: any; color: string }> = {
  email: { label: "إيميل", icon: Mail, color: "text-blue-600" },
  sms: { label: "SMS", icon: Smartphone, color: "text-amber-600" },
  whatsapp: { label: "واتساب", icon: MessageCircle, color: "text-emerald-600" },
  in_app: { label: "داخل اللوحة", icon: Inbox, color: "text-indigo-600" },
  push: { label: "Web Push", icon: Bell, color: "text-purple-600" },
};

function NotificationsPage() {
  const { user } = useAuth();
  const { canManage } = useUserRole();
  const [tab, setTab] = useState<"log" | "templates" | "rules" | "inbox">("inbox");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [adminNotifs, setAdminNotifs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [editingTpl, setEditingTpl] = useState<any | null>(null);
  const [previewTpl, setPreviewTpl] = useState<any | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [l, t, r, a] = await Promise.all([
      supabase.from("notification_log").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("notification_templates").select("*").order("event_code"),
      supabase.from("notification_rules").select("*").order("event_code"),
      supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setLogs(l.data || []); setTemplates(t.data || []); setRules(r.data || []); setAdminNotifs(a.data || []);
    setLoading(false);
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (channelFilter !== "all" && l.channel !== channelFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (l.event_code || "").toLowerCase().includes(q) ||
          (l.recipient_email || "").toLowerCase().includes(q) ||
          (l.recipient_phone || "").toLowerCase().includes(q) ||
          (l.body_preview || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, statusFilter, channelFilter, search]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      sent: logs.filter((l) => l.status === "sent").length,
      failed: logs.filter((l) => l.status === "failed").length,
      pending: logs.filter((l) => ["pending", "queued", "pending_dispatch"].includes(l.status)).length,
    };
  }, [logs]);

  async function markRead(id: string) {
    if (!user) return;
    const notif = adminNotifs.find((n) => n.id === id);
    if (!notif) return;
    const readBy = Array.isArray(notif.read_by) ? notif.read_by : [];
    if (readBy.includes(user.id)) return;
    await supabase.from("admin_notifications").update({ read_by: [...readBy, user.id] }).eq("id", id);
    setAdminNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_by: [...readBy, user.id] } : n)));
  }

  async function markAllRead() {
    if (!user) return;
    const unread = adminNotifs.filter((n) => !((n.read_by || []) as string[]).includes(user.id));
    await Promise.all(unread.map((n) => supabase.from("admin_notifications").update({ read_by: [...(n.read_by || []), user.id] }).eq("id", n.id)));
    void loadAll();
  }

  async function toggleTemplate(t: any) {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    await supabase.from("notification_templates").update({ is_enabled: !t.is_enabled }).eq("id", t.id);
    void loadAll();
  }

  async function toggleRule(r: any) {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    await supabase.from("notification_rules").update({ is_enabled: !r.is_enabled }).eq("id", r.id);
    void loadAll();
  }

  async function toggleRuleChannel(r: any, channel: NotificationChannel) {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    const channels = Array.isArray(r.channels) ? [...r.channels] : [];
    const idx = channels.indexOf(channel);
    if (idx >= 0) channels.splice(idx, 1);
    else channels.push(channel);
    await supabase.from("notification_rules").update({ channels }).eq("id", r.id);
    void loadAll();
  }

  async function changeMode(r: any, mode: string) {
    if (!canManage) return;
    await supabase.from("notification_rules").update({ trigger_mode: mode }).eq("id", r.id);
    void loadAll();
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            <p className="text-sm text-muted-foreground">إدارة القوالب، القواعد، السجل، وصندوق الوارد</p>
          </div>
          <button onClick={loadAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> تحديث
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="إجمالي" value={String(stats.total)} icon={Send} tone="text-blue-600" />
          <Kpi label="مرسلة" value={String(stats.sent)} icon={CheckCircle2} tone="text-emerald-600" />
          <Kpi label="بانتظار" value={String(stats.pending)} icon={Clock} tone="text-amber-600" />
          <Kpi label="فشل" value={String(stats.failed)} icon={XCircle} tone="text-red-600" />
        </div>

        <div className="border-b border-border flex gap-1 overflow-x-auto">
          <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")} icon={Inbox} label={`صندوق الوارد ${adminNotifs.filter(n => !((n.read_by||[]) as string[]).includes(user?.id||"")).length || ""}`} />
          <TabBtn active={tab === "log"} onClick={() => setTab("log")} icon={FileText} label="السجل" />
          <TabBtn active={tab === "templates"} onClick={() => setTab("templates")} icon={Edit3} label="القوالب" />
          <TabBtn active={tab === "rules"} onClick={() => setTab("rules")} icon={SettingsIcon} label="القواعد" />
        </div>

        {tab === "inbox" && (
          <div className="space-y-2">
            {adminNotifs.length > 0 && (
              <button onClick={markAllRead} className="text-sm text-primary hover:underline">تعليم الكل كمقروء</button>
            )}
            {adminNotifs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-border rounded-xl">لا توجد إشعارات</div>
            ) : adminNotifs.map((n) => {
              const isRead = ((n.read_by || []) as string[]).includes(user?.id || "");
              const tone = sevTone(n.severity);
              return (
                <div key={n.id} onClick={() => markRead(n.id)}
                  className={`p-4 rounded-lg border ${isRead ? "border-border bg-card" : "border-primary/30 bg-primary/5"} cursor-pointer hover:bg-muted/50 transition`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs ${tone}`}>{n.severity}</span>
                        <span className="text-xs text-muted-foreground font-mono">{n.event_code}</span>
                        {!isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div className="font-medium mt-1">{n.title}</div>
                      {n.body && <div className="text-sm text-muted-foreground mt-1">{n.body}</div>}
                      {n.link && <a href={n.link} className="text-xs text-primary hover:underline mt-1 inline-block">عرض التفاصيل ←</a>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(n.created_at).toLocaleString("ar")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "log" && (
          <>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث في الحدث، المستلم، المحتوى..."
                  className="w-full pr-10 pl-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="all">كل الحالات</option>
                <option value="sent">مرسل</option>
                <option value="queued">في الطابور</option>
                <option value="pending">بانتظار</option>
                <option value="pending_dispatch">بانتظار الإرسال</option>
                <option value="failed">فشل</option>
              </select>
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="all">كل القنوات</option>
                {Object.entries(CHANNEL_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
              : filteredLogs.length === 0 ? <div className="p-12 text-center text-muted-foreground">لا توجد سجلات</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-right p-3 font-medium">التاريخ</th>
                        <th className="text-right p-3 font-medium">الحدث</th>
                        <th className="text-right p-3 font-medium">القناة</th>
                        <th className="text-right p-3 font-medium">المستلم</th>
                        <th className="text-right p-3 font-medium">المحتوى</th>
                        <th className="text-right p-3 font-medium">الحالة</th>
                        <th className="text-right p-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((l) => {
                        const ch = CHANNEL_META[l.channel as NotificationChannel];
                        const Icon = ch?.icon || Bell;
                        return (
                          <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                            <td className="p-3 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("ar")}</td>
                            <td className="p-3 font-mono text-xs">{l.event_code}</td>
                            <td className="p-3"><span className={`inline-flex items-center gap-1 ${ch?.color}`}><Icon className="h-3.5 w-3.5" />{ch?.label || l.channel}</span></td>
                            <td className="p-3 text-xs">{l.recipient_email || l.recipient_phone || "—"}</td>
                            <td className="p-3 text-xs max-w-xs truncate">{l.body_preview || "—"}</td>
                            <td className="p-3">{statusBadge(l.status)}{l.error_message && <div className="text-[10px] text-red-600 mt-1">{l.error_message}</div>}</td>
                            <td className="p-3">
                              {l.status === "failed" && (
                                <button onClick={async () => { await retryNotification(l.id); toast.success("تمت إعادة الإرسال"); loadAll(); }}
                                  className="p-1.5 rounded hover:bg-muted" title="إعادة الإرسال">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "templates" && (
          <div className="space-y-2">
            {templates.map((t) => {
              const ch = CHANNEL_META[t.channel as NotificationChannel];
              const Icon = ch?.icon || Bell;
              return (
                <div key={t.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={`h-4 w-4 ${ch?.color}`} />
                      <span className="font-medium text-sm">{t.template_key}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{t.audience}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{t.language}</span>
                    </div>
                    {t.subject && <div className="text-xs text-muted-foreground mt-1 truncate">{t.subject}</div>}
                    <div className="text-xs text-muted-foreground mt-1 truncate">{t.body}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPreviewTpl(t)} className="p-1.5 rounded hover:bg-muted" title="معاينة"><Eye className="h-4 w-4" /></button>
                    {canManage && <button onClick={() => setEditingTpl(t)} className="p-1.5 rounded hover:bg-muted" title="تعديل"><Edit3 className="h-4 w-4" /></button>}
                    <button onClick={() => toggleTemplate(t)} disabled={!canManage} className={`relative w-10 h-5 rounded-full transition ${t.is_enabled ? "bg-primary" : "bg-muted"} ${!canManage ? "opacity-50" : ""}`}>
                      <span className={`absolute top-0.5 ${t.is_enabled ? "right-0.5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "rules" && (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-medium text-sm">{r.event_code} <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.audience}</span></div>
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  </div>
                  <button onClick={() => toggleRule(r)} disabled={!canManage} className={`relative w-10 h-5 rounded-full transition ${r.is_enabled ? "bg-primary" : "bg-muted"} ${!canManage ? "opacity-50" : ""}`}>
                    <span className={`absolute top-0.5 ${r.is_enabled ? "right-0.5" : "left-0.5"} w-4 h-4 bg-white rounded-full transition`} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">القنوات:</span>
                  {(Object.keys(CHANNEL_META) as NotificationChannel[]).map((ch) => {
                    const active = ((r.channels as NotificationChannel[]) || []).includes(ch);
                    const meta = CHANNEL_META[ch];
                    const Icon = meta.icon;
                    return (
                      <button key={ch} onClick={() => toggleRuleChannel(r, ch)} disabled={!canManage}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${active ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"} ${!canManage ? "opacity-50" : "hover:bg-muted"}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </button>
                    );
                  })}
                  <span className="text-xs text-muted-foreground mx-2">•</span>
                  <select value={r.trigger_mode} onChange={(e) => changeMode(r, e.target.value)} disabled={!canManage} className="text-xs px-2 py-1 rounded border border-border bg-background">
                    <option value="auto">تلقائي</option>
                    <option value="manual">يدوي</option>
                  </select>
                  <span className="text-xs text-muted-foreground">إعادة المحاولة: {r.max_retries}</span>
                  <span className="text-xs text-muted-foreground">{r.allow_resend ? "يسمح بإعادة الإرسال" : "إرسال واحد"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewTpl && <PreviewDialog template={previewTpl} onClose={() => setPreviewTpl(null)} />}
      {editingTpl && <EditDialog template={editingTpl} onClose={() => setEditingTpl(null)} onSaved={() => { setEditingTpl(null); loadAll(); }} />}
    </AdminShell>
  );
}

function PreviewDialog({ template, onClose }: any) {
  const [vars, setVars] = useState<Record<string, string>>({});
  const [testRecipient, setTestRecipient] = useState("");

  useEffect(() => {
    const sampleMap: Record<string, string> = {
      customer_name: "أحمد", order_number: "MN-251028-1234", total: "450", amount: "450",
      tracking_number: "TRK123", tracking_url: "https://example.com/track",
      payment_link: "https://example.com/pay", product_name: "حذاء أطفال",
      product_link: "https://example.com/p", cart_total: "320",
      recovery_link: "https://example.com/cart", site_name: "Maisonnet", stock: "3", reason: "—",
    };
    const initial: Record<string, string> = {};
    (template.variables as string[] || []).forEach((v) => { initial[v] = sampleMap[v] || `{${v}}`; });
    setVars(initial);
  }, [template.id]);

  const renderedSubject = template.subject ? renderTemplate(template.subject, vars) : "";
  const renderedBody = renderTemplate(template.body, vars);

  async function sendTest() {
    if (!testRecipient) return toast.error("أدخل البريد أو الجوال");
    const isEmail = testRecipient.includes("@");
    const result = await notify({
      event_code: template.event_code,
      audience: template.audience,
      recipient_email: isEmail ? testRecipient : undefined,
      recipient_phone: !isEmail ? testRecipient : undefined,
      variables: vars,
      channels_override: [template.channel],
    });
    if (result.ok) toast.success("تم إرسال الاختبار");
    else toast.error("فشل: " + (result.reason || ""));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-background rounded-xl p-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">معاينة: {template.template_key}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><XCircle className="h-5 w-5" /></button>
        </div>

        {((template.variables as string[]) || []).length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">المتغيرات:</div>
            <div className="grid grid-cols-2 gap-2">
              {(template.variables as string[]).map((v) => (
                <div key={v}>
                  <label className="text-xs text-muted-foreground">{v}</label>
                  <input value={vars[v] || ""} onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                    className="w-full p-2 rounded border border-border bg-background text-sm" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
          {renderedSubject && <div className="font-bold">{renderedSubject}</div>}
          <pre className="text-sm whitespace-pre-wrap font-sans">{renderedBody}</pre>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-sm font-medium">إرسال اختبار:</div>
          <div className="flex gap-2">
            <input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)}
              placeholder={template.channel === "email" ? "test@example.com" : "+9665xxxxxxxx"}
              className="flex-1 p-2 rounded border border-border bg-background text-sm" />
            <button onClick={sendTest} className="px-3 rounded bg-primary text-primary-foreground text-sm flex items-center gap-1">
              <Send className="h-4 w-4" /> إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditDialog({ template, onClose, onSaved }: any) {
  const [subject, setSubject] = useState(template.subject || "");
  const [body, setBody] = useState(template.body || "");
  const [variables, setVariables] = useState((template.variables as string[] || []).join(", "));

  async function save() {
    const vars = variables.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("notification_templates").update({
      subject: subject || null, body, variables: vars,
    }).eq("id", template.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-background rounded-xl p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">تعديل: {template.template_key}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><XCircle className="h-5 w-5" /></button>
        </div>
        {template.channel === "email" && (
          <div>
            <label className="text-xs text-muted-foreground">عنوان البريد</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-2 rounded border border-border bg-background text-sm" />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">المحتوى — استخدم <code>{"{{variable}}"}</code> للمتغيرات</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
            className="w-full p-2 rounded border border-border bg-background text-sm font-mono" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">المتغيرات (مفصولة بفواصل)</label>
          <input value={variables} onChange={(e) => setVariables(e.target.value)} className="w-full p-2 rounded border border-border bg-background text-sm font-mono" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 p-2 rounded border border-border text-sm">إلغاء</button>
          <button onClick={save} className="flex-1 p-2 rounded bg-primary text-primary-foreground text-sm">حفظ</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: any) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 whitespace-nowrap ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function statusBadge(status: string) {
  const m: Record<string, string> = {
    sent: "bg-emerald-100 text-emerald-800",
    queued: "bg-blue-100 text-blue-800",
    pending: "bg-amber-100 text-amber-800",
    pending_dispatch: "bg-amber-100 text-amber-800",
    failed: "bg-red-100 text-red-800",
  };
  return <span className={`text-xs px-2 py-1 rounded ${m[status] || "bg-muted"}`}>{status}</span>;
}

function sevTone(sev: string): string {
  const m: Record<string, string> = {
    info: "bg-blue-100 text-blue-800",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  };
  return m[sev] || "bg-muted";
}
