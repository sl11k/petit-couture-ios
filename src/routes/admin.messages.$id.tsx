import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { DetailShell, Section, Field, Select, TextArea } from "@/features/admin/components/DetailShell";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/messages/$id")({
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { id } = useParams({ from: "/admin/messages/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [conv, setConv] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const [c, m] = await Promise.all([
      supabase.from("messaging_conversations").select("*").eq("id", id).maybeSingle(),
      supabase.from("messaging_messages").select("*").eq("conversation_id", id).order("created_at"),
    ]);
    setConv(c.data);
    setMsgs(m.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("messaging_conversations").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم التحديث" : "Updated"); load(); }
  };

  const send = async () => {
    if (!body.trim() || !conv) return;
    setSending(true);
    const { error } = await supabase.from("messaging_messages").insert({
      conversation_id: id,
      direction: "outbound",
      channel: conv.channel,
      body,
      status: "queued",
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    load();
  };

  return (
    <DetailShell
      backTo="/admin/messages"
      backLabel={{ ar: "الرسائل", en: "Messages" }}
      title={conv?.customer_name ?? conv?.customer_phone ?? ""}
      description={conv ? { ar: `${conv.channel} • ${conv.customer_phone}`, en: `${conv.channel} • ${conv.customer_phone}` } : undefined}
      loading={loading}
      notFound={!loading && !conv}
      actions={
        conv && (
          <Select value={conv.status} onChange={(e) => updateStatus(e.target.value)}>
            <option value="open">{ar ? "مفتوحة" : "Open"}</option>
            <option value="resolved">{ar ? "محلولة" : "Resolved"}</option>
            <option value="archived">{ar ? "مؤرشفة" : "Archived"}</option>
          </Select>
        )
      }
    >
      {conv && (
        <div className="space-y-4">
          <Section title={ar ? "الرسائل" : "Messages"}>
            {msgs.length === 0 ? (
              <div className="text-xs text-muted-foreground">{ar ? "لا توجد رسائل" : "No messages"}</div>
            ) : (
              <div className="space-y-2">
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className="mt-1 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleString(ar ? "ar" : "en")} • {m.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={ar ? "إرسال رسالة" : "Send message"}>
            <Field label={ar ? "النص" : "Text"}>
              <TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder={ar ? "اكتب رسالة..." : "Type a message..."} />
            </Field>
            <div className="mt-2 flex justify-end">
              <button
                onClick={send}
                disabled={sending || !body.trim()}
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
