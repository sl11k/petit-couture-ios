import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { DetailShell, Section, Field, TextInput, TextArea, Select, Toggle } from "@/features/admin/components/DetailShell";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/campaigns/$id")({
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = useParams({ from: "/admin/campaigns/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("marketing_campaigns").select("*").eq("id", id).maybeSingle();
      setC(data);
      setLoading(false);
    })();
  }, [id]);

  const u = (k: string, v: any) => setC((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id: _, created_at, updated_at, sent_count, open_count, click_count, conversion_count, revenue_attributed, created_by, ...rest } = c;
    const { error } = await supabase.from("marketing_campaigns").update(rest).eq("id", id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success(ar ? "تم الحفظ" : "Saved");
  };

  const ctr = c?.sent_count ? ((c.click_count / c.sent_count) * 100).toFixed(1) : "—";
  const cr = c?.click_count ? ((c.conversion_count / c.click_count) * 100).toFixed(1) : "—";

  return (
    <DetailShell
      backTo="/admin/campaigns"
      backLabel={{ ar: "الحملات", en: "Campaigns" }}
      title={c?.name ?? ""}
      description={c ? { ar: c.status, en: c.status } : undefined}
      loading={loading}
      notFound={!loading && !c}
      actions={
        c && (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {ar ? "حفظ" : "Save"}
          </button>
        )
      }
    >
      {c && (
        <div className="space-y-4">
          <Section title={ar ? "الأساسيات" : "Basics"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "الاسم" : "Name"}><TextInput value={c.name ?? ""} onChange={(e) => u("name", e.target.value)} /></Field>
              <Field label={ar ? "النوع" : "Type"}>
                <Select value={c.campaign_type} onChange={(e) => u("campaign_type", e.target.value)}>
                  <option value="banner">Banner</option><option value="email">Email</option>
                  <option value="sms">SMS</option><option value="push">Push</option>
                </Select>
              </Field>
              <Field label={ar ? "الحالة" : "Status"}>
                <Select value={c.status} onChange={(e) => u("status", e.target.value)}>
                  <option value="draft">Draft</option><option value="scheduled">Scheduled</option>
                  <option value="active">Active</option><option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                </Select>
              </Field>
              <Field label={ar ? "الجمهور" : "Audience"}>
                <TextInput value={c.target_audience ?? ""} onChange={(e) => u("target_audience", e.target.value)} />
              </Field>
              <Field label={ar ? "الكوبون" : "Coupon code"}>
                <TextInput value={c.coupon_code ?? ""} onChange={(e) => u("coupon_code", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title={ar ? "المدة" : "Schedule"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "يبدأ" : "Starts at"}>
                <TextInput type="datetime-local" value={c.starts_at ? c.starts_at.slice(0, 16) : ""} onChange={(e) => u("starts_at", e.target.value || null)} />
              </Field>
              <Field label={ar ? "ينتهي" : "Ends at"}>
                <TextInput type="datetime-local" value={c.ends_at ? c.ends_at.slice(0, 16) : ""} onChange={(e) => u("ends_at", e.target.value || null)} />
              </Field>
            </div>
          </Section>

          {(c.campaign_type === "email" || c.campaign_type === "sms") && (
            <Section title={ar ? "الرسالة" : "Message"}>
              <div className="space-y-3">
                {c.campaign_type === "email" && (
                  <Field label={ar ? "الموضوع" : "Subject"}>
                    <TextInput value={c.email_subject ?? ""} onChange={(e) => u("email_subject", e.target.value)} />
                  </Field>
                )}
                <Field label={ar ? "النص" : "Body"}>
                  <TextArea value={c.email_body ?? ""} onChange={(e) => u("email_body", e.target.value)} />
                </Field>
              </div>
            </Section>
          )}

          {c.campaign_type === "banner" && (
            <Section title={ar ? "البانر" : "Banner"}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={ar ? "رابط الصورة" : "Image URL"}>
                  <TextInput value={c.banner_image_url ?? ""} onChange={(e) => u("banner_image_url", e.target.value)} />
                </Field>
                <Field label={ar ? "رابط الانتقال" : "Link URL"}>
                  <TextInput value={c.banner_link_url ?? ""} onChange={(e) => u("banner_link_url", e.target.value)} />
                </Field>
              </div>
            </Section>
          )}

          <Section title={ar ? "الأداء" : "Performance"}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                [ar ? "أُرسل" : "Sent", c.sent_count],
                [ar ? "فُتح" : "Opens", c.open_count],
                [ar ? "نقرات" : "Clicks", c.click_count],
                [ar ? "تحويلات" : "Conv.", c.conversion_count],
                [ar ? "إيرادات" : "Revenue", (c.revenue_attributed ?? 0).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-md border border-border bg-background p-3 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                  <div className="mt-1 text-lg font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground">
              <div>CTR: <span className="font-medium text-foreground">{ctr}{ctr !== "—" && "%"}</span></div>
              <div>CR: <span className="font-medium text-foreground">{cr}{cr !== "—" && "%"}</span></div>
            </div>
          </Section>
        </div>
      )}
    </DetailShell>
  );
}
