import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { DetailShell, Section, Field, TextInput, TextArea, Toggle } from "@/features/admin/components/DetailShell";
import { Save, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/landing-pages/$id")({
  component: LandingDetailPage,
});

function LandingDetailPage() {
  const { id } = useParams({ from: "/admin/landing-pages/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("landing_pages").select("*").eq("id", id).maybeSingle();
      setC(data);
      setLoading(false);
    })();
  }, [id]);

  const u = (k: string, v: any) => setC((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id: _, created_at, updated_at, views, ...rest } = c;
    const { error } = await supabase.from("landing_pages").update(rest).eq("id", id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success(ar ? "تم الحفظ" : "Saved");
  };

  return (
    <DetailShell
      backTo="/admin/landing-pages"
      backLabel={{ ar: "صفحات الهبوط", en: "Landing Pages" }}
      title={c?.title ?? ""}
      description={c ? { ar: `/${c.slug}`, en: `/${c.slug}` } : undefined}
      loading={loading}
      notFound={!loading && !c}
      actions={
        c && (
          <div className="flex gap-2">
            <a href={`/lp/${c.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
              <ExternalLink className="h-3 w-3" /> {ar ? "معاينة" : "Preview"}
            </a>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {ar ? "حفظ" : "Save"}
            </button>
          </div>
        )
      }
    >
      {c && (
        <div className="space-y-4">
          <Section title={ar ? "المحتوى" : "Content"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "العنوان" : "Title"}><TextInput value={c.title ?? ""} onChange={(e) => u("title", e.target.value)} /></Field>
              <Field label={ar ? "الرابط (slug)" : "Slug"}><TextInput value={c.slug ?? ""} onChange={(e) => u("slug", e.target.value)} /></Field>
              <Field label={ar ? "العنوان الفرعي" : "Subtitle"}><TextInput value={c.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} /></Field>
              <Field label={ar ? "صورة الهيرو" : "Hero image URL"}><TextInput value={c.hero_image ?? ""} onChange={(e) => u("hero_image", e.target.value)} /></Field>
              <Field label={ar ? "نص الزر" : "CTA text"}><TextInput value={c.cta_text ?? ""} onChange={(e) => u("cta_text", e.target.value)} /></Field>
              <Field label={ar ? "رابط الزر" : "CTA URL"}><TextInput value={c.cta_url ?? ""} onChange={(e) => u("cta_url", e.target.value)} /></Field>
              <div className="sm:col-span-2">
                <Field label={ar ? "الوصف" : "Description"}><TextArea value={c.description ?? ""} onChange={(e) => u("description", e.target.value)} /></Field>
              </div>
            </div>
          </Section>

          <Section title={ar ? "التسويق" : "Marketing"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={ar ? "كود الكوبون" : "Coupon code"}><TextInput value={c.coupon_code ?? ""} onChange={(e) => u("coupon_code", e.target.value)} /></Field>
              <Field label="UTM campaign"><TextInput value={c.utm_campaign ?? ""} onChange={(e) => u("utm_campaign", e.target.value)} /></Field>
              <Toggle checked={!!c.is_active} onChange={(v) => u("is_active", v)} label={ar ? "نشطة" : "Active"} />
            </div>
          </Section>

          <Section title={ar ? "الإحصائيات" : "Stats"}>
            <div className="rounded-md border border-border bg-background p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">{ar ? "المشاهدات" : "Views"}</div>
              <div className="mt-1 text-2xl font-semibold">{(c.views ?? 0).toLocaleString()}</div>
            </div>
          </Section>
        </div>
      )}
    </DetailShell>
  );
}
