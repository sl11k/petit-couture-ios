import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { DetailShell, Section, Field, TextInput, Toggle } from "@/features/admin/components/DetailShell";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/webhooks/$id")({
  component: WebhookDetailPage,
});

function WebhookDetailPage() {
  const { id } = useParams({ from: "/admin/webhooks/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [ep, setEp] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [e, d] = await Promise.all([
      supabase.from("webhook_endpoints").select("*").eq("id", id).maybeSingle(),
      supabase.from("webhook_deliveries").select("*").eq("endpoint_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setEp(e.data);
    setDeliveries(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const u = (k: string, v: any) => setEp((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id: _, created_at, updated_at, last_delivery_at, last_delivery_status, failure_count, ...rest } = ep;
    const { error } = await supabase.from("webhook_endpoints").update(rest).eq("id", id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success(ar ? "تم الحفظ" : "Saved");
  };

  return (
    <DetailShell
      backTo="/admin/webhooks"
      backLabel={{ ar: "Webhooks", en: "Webhooks" }}
      title={ep?.name ?? ""}
      description={ep ? { ar: ep.url, en: ep.url } : undefined}
      loading={loading}
      notFound={!loading && !ep}
      actions={
        ep && (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {ar ? "حفظ" : "Save"}
          </button>
        )
      }
    >
      {ep && (
        <div className="space-y-4">
          <Section title={ar ? "الإعدادات" : "Settings"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "الاسم" : "Name"}><TextInput value={ep.name ?? ""} onChange={(e) => u("name", e.target.value)} /></Field>
              <Field label="URL"><TextInput value={ep.url ?? ""} onChange={(e) => u("url", e.target.value)} /></Field>
              <Field label={ar ? "السر (Secret)" : "Secret"}><TextInput type="password" value={ep.secret ?? ""} onChange={(e) => u("secret", e.target.value)} /></Field>
              <Field label={ar ? "الأحداث (مفصولة بفاصلة)" : "Events (comma separated)"}>
                <TextInput
                  value={(ep.events ?? []).join(",")}
                  onChange={(e) => u("events", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                />
              </Field>
              <Toggle checked={!!ep.enabled} onChange={(v) => u("enabled", v)} label={ar ? "مفعّل" : "Enabled"} />
            </div>
          </Section>

          <Section title={ar ? "آخر التسليمات" : "Recent deliveries"}>
            {deliveries.length === 0 ? (
              <div className="text-xs text-muted-foreground">{ar ? "لا توجد تسليمات" : "No deliveries yet"}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-2 py-1.5 text-start">{ar ? "الوقت" : "Time"}</th>
                      <th className="px-2 py-1.5 text-start">{ar ? "الحدث" : "Event"}</th>
                      <th className="px-2 py-1.5 text-start">{ar ? "الحالة" : "Status"}</th>
                      <th className="px-2 py-1.5 text-start">HTTP</th>
                      <th className="px-2 py-1.5 text-start">{ar ? "محاولة" : "Attempt"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id} className="border-b border-border/50">
                        <td className="px-2 py-1.5">{new Date(d.created_at).toLocaleString(ar ? "ar" : "en")}</td>
                        <td className="px-2 py-1.5">{d.event_type}</td>
                        <td className="px-2 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                            d.status === "delivered" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                            d.status === "failed" ? "bg-destructive/10 text-destructive" :
                            "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          }`}>{d.status}</span>
                        </td>
                        <td className="px-2 py-1.5">{d.http_status ?? "—"}</td>
                        <td className="px-2 py-1.5">{d.attempt}/{d.max_attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </DetailShell>
  );
}
