import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { DetailShell, Section, Field, TextInput, Select, Toggle } from "@/features/admin/components/DetailShell";
import { Save, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/integrations/$id")({
  component: IntegrationDetailPage,
});

function IntegrationDetailPage() {
  const { id } = useParams({ from: "/admin/integrations/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [it, setIt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("integrations").select("*").eq("id", id).maybeSingle();
      setIt(data);
      setLoading(false);
    })();
  }, [id]);

  const u = (k: string, v: any) => setIt((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id: _, created_at, updated_at, last_test_at, last_test_ok, last_test_message, ...rest } = it;
    const { error } = await supabase.from("integrations").update(rest).eq("id", id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success(ar ? "تم الحفظ" : "Saved");
  };

  return (
    <DetailShell
      backTo="/admin/integrations"
      backLabel={{ ar: "التكاملات", en: "Integrations" }}
      title={it?.display_name ?? it?.provider ?? ""}
      description={it ? { ar: `${it.category} • ${it.provider}`, en: `${it.category} • ${it.provider}` } : undefined}
      loading={loading}
      notFound={!loading && !it}
      actions={
        it && (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {ar ? "حفظ" : "Save"}
          </button>
        )
      }
    >
      {it && (
        <div className="space-y-4">
          <Section title={ar ? "الحالة" : "Status"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Toggle checked={!!it.enabled} onChange={(v) => u("enabled", v)} label={ar ? "مفعّل" : "Enabled"} />
              <Field label={ar ? "الوضع" : "Mode"}>
                <Select value={it.mode} onChange={(e) => u("mode", e.target.value)}>
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </Select>
              </Field>
              <Field label={ar ? "الاسم المعروض" : "Display name"}>
                <TextInput value={it.display_name ?? ""} onChange={(e) => u("display_name", e.target.value)} />
              </Field>
            </div>
            {it.last_test_at && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                {it.last_test_ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                <span className="text-muted-foreground">
                  {ar ? "آخر اختبار:" : "Last test:"} {new Date(it.last_test_at).toLocaleString(ar ? "ar" : "en")}
                </span>
                {it.last_test_message && <span className="text-muted-foreground">— {it.last_test_message}</span>}
              </div>
            )}
          </Section>

          <Section title={ar ? "بيانات الاعتماد" : "Credentials"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="API Key">
                <TextInput type="password" value={it.api_key ?? ""} onChange={(e) => u("api_key", e.target.value)} />
              </Field>
              <Field label="API Secret">
                <TextInput type="password" value={it.api_secret ?? ""} onChange={(e) => u("api_secret", e.target.value)} />
              </Field>
              <Field label="Webhook URL">
                <TextInput value={it.webhook_url ?? ""} onChange={(e) => u("webhook_url", e.target.value)} />
              </Field>
              <Field label="Webhook Secret">
                <TextInput type="password" value={it.webhook_secret ?? ""} onChange={(e) => u("webhook_secret", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title={ar ? "إعدادات إضافية (JSON)" : "Extra config (JSON)"}>
            <textarea
              value={JSON.stringify(it.config ?? {}, null, 2)}
              onChange={(e) => {
                try { u("config", JSON.parse(e.target.value)); } catch { /* ignore parse errors while typing */ }
              }}
              className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
              rows={8}
            />
          </Section>
        </div>
      )}
    </DetailShell>
  );
}
