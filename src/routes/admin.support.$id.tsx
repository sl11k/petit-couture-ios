import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { DetailShell, Section, Field, Select, TextArea } from "@/features/admin/components/DetailShell";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/support/$id")({
  component: TicketDetailPage,
});

function TicketDetailPage() {
  const { id } = useParams({ from: "/admin/support/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [t, setT] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const [tk, mg] = await Promise.all([
      supabase.from("support_tickets").select("*").eq("id", id).maybeSingle(),
      supabase.from("support_ticket_messages").select("*").eq("ticket_id", id).order("created_at"),
    ]);
    setT(tk.data);
    setMsgs(mg.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم التحديث" : "Updated"); load(); }
  };

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: id,
      body: reply,
      direction: "staff",
      is_internal_note: internal,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setReply("");
    setInternal(false);
    load();
  };

  return (
    <DetailShell
      backTo="/admin/support"
      backLabel={{ ar: "التذاكر", en: "Tickets" }}
      title={t?.subject ?? ""}
      description={t ? { ar: `${t.ticket_number} • ${t.customer_email}`, en: `${t.ticket_number} • ${t.customer_email}` } : undefined}
      loading={loading}
      notFound={!loading && !t}
      actions={
        t && (
          <Select value={t.status} onChange={(e) => updateStatus(e.target.value)}>
            <option value="new">{ar ? "جديدة" : "New"}</option>
            <option value="waiting_admin">{ar ? "بانتظار الرد" : "Waiting admin"}</option>
            <option value="waiting_customer">{ar ? "بانتظار العميل" : "Waiting customer"}</option>
            <option value="resolved">{ar ? "محلولة" : "Resolved"}</option>
            <option value="closed">{ar ? "مغلقة" : "Closed"}</option>
          </Select>
        )
      }
    >
      {t && (
        <div className="space-y-4">
          <Section title={ar ? "بيانات التذكرة" : "Ticket info"}>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Info label={ar ? "الأولوية" : "Priority"} value={t.priority} />
              <Info label={ar ? "الفئة" : "Category"} value={t.category} />
              <Info label={ar ? "العميل" : "Customer"} value={t.customer_name ?? t.customer_email} />
              <Info label={ar ? "الهاتف" : "Phone"} value={t.customer_phone ?? "—"} />
            </div>
          </Section>

          <Section title={ar ? "المحادثة" : "Conversation"}>
            {msgs.length === 0 ? (
              <div className="text-xs text-muted-foreground">{ar ? "لا توجد رسائل" : "No messages"}</div>
            ) : (
              <div className="space-y-2">
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md border p-3 text-xs ${
                      m.is_internal_note
                        ? "border-amber-500/30 bg-amber-500/5"
                        : m.direction === "customer"
                        ? "border-border bg-muted/40"
                        : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {m.is_internal_note ? (ar ? "ملاحظة داخلية" : "Internal note") :
                          m.direction === "customer" ? (ar ? "العميل" : "Customer") :
                          (ar ? "موظف" : "Staff")} • {m.author_name ?? m.author_email ?? ""}
                      </span>
                      <span>{new Date(m.created_at).toLocaleString(ar ? "ar" : "en")}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={ar ? "رد جديد" : "New reply"}>
            <Field label={ar ? "نص الرد" : "Reply text"}>
              <TextArea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={ar ? "اكتب الرد..." : "Type your reply..."} />
            </Field>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                {ar ? "ملاحظة داخلية (لا تُرسل للعميل)" : "Internal note (not sent to customer)"}
              </label>
              <button
                onClick={send}
                disabled={sending || !reply.trim()}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {ar ? "إرسال" : "Send"}
              </button>
            </div>
          </Section>
        </div>
      )}
    </DetailShell>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}
