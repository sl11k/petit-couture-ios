import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(data));
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({
        store_name: s.store_name,
        hero_title_ar: s.hero_title_ar,
        hero_title_en: s.hero_title_en,
        hero_subtitle_ar: s.hero_subtitle_ar,
        hero_subtitle_en: s.hero_subtitle_en,
        hero_image_url: s.hero_image_url,
        whatsapp_number: s.whatsapp_number,
        support_email: s.support_email,
        free_shipping_threshold: Number(s.free_shipping_threshold),
        shipping_fee: Number(s.shipping_fee),
        tax_rate: Number(s.tax_rate),
        announcement_bar: s.announcement_bar,
      })
      .eq("id", 1);
    setSaving(false);
    setMsg(error ? error.message : "تم الحفظ ✓");
    setTimeout(() => setMsg(""), 3000);
  }

  if (!s)
    return (
      <AdminShell>
        <p>جاري التحميل...</p>
      </AdminShell>
    );

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold">إعدادات المتجر</h1>
      <p className="mt-1 text-sm text-muted-foreground">يمكنك تعديل واجهة المتجر من هنا</p>

      <div className="mt-6 space-y-6">
        <Section title="معلومات أساسية">
          <Field label="اسم المتجر" value={s.store_name} onChange={(v) => setS({ ...s, store_name: v })} />
          <Field label="شريط الإعلانات" value={s.announcement_bar} onChange={(v) => setS({ ...s, announcement_bar: v })} />
        </Section>

        <Section title="الصفحة الرئيسية (Hero)">
          <Field label="العنوان (عربي)" value={s.hero_title_ar} onChange={(v) => setS({ ...s, hero_title_ar: v })} />
          <Field label="العنوان (إنجليزي)" value={s.hero_title_en} onChange={(v) => setS({ ...s, hero_title_en: v })} />
          <Field label="العنوان الفرعي (عربي)" value={s.hero_subtitle_ar} onChange={(v) => setS({ ...s, hero_subtitle_ar: v })} />
          <Field label="العنوان الفرعي (إنجليزي)" value={s.hero_subtitle_en} onChange={(v) => setS({ ...s, hero_subtitle_en: v })} />
          <Field label="رابط صورة الـ Hero" value={s.hero_image_url} onChange={(v) => setS({ ...s, hero_image_url: v })} />
        </Section>

        <Section title="التواصل">
          <Field label="رقم الواتساب (مع الكود الدولي بدون +)" value={s.whatsapp_number} onChange={(v) => setS({ ...s, whatsapp_number: v })} />
          <Field label="بريد الدعم" value={s.support_email} onChange={(v) => setS({ ...s, support_email: v })} />
        </Section>

        <Section title="الشحن والضريبة">
          <Field label="سعر الشحن" type="number" value={s.shipping_fee} onChange={(v) => setS({ ...s, shipping_fee: v })} />
          <Field label="حد الشحن المجاني" type="number" value={s.free_shipping_threshold} onChange={(v) => setS({ ...s, free_shipping_threshold: v })} />
          <Field label="نسبة الضريبة (مثال: 0.15 = 15%)" type="number" value={s.tax_rate} onChange={(v) => setS({ ...s, tax_rate: v })} />
        </Section>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "..." : "حفظ التغييرات"}
          </button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}
function Field({ label, value, onChange, type = "text" }: any) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
