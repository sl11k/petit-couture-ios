import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  DetailShell, Section, Field, TextInput, TextArea, Select, Toggle,
} from "@/features/admin/components/DetailShell";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/coupons/$id")({
  component: CouponDetailPage,
});

function CouponDetailPage() {
  const { id } = useParams({ from: "/admin/coupons/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("coupons").select("*").eq("id", id).maybeSingle();
      setC(data);
      setLoading(false);
    })();
  }, [id]);

  const u = (k: string, v: any) => setC((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { id: _, created_at, updated_at, used_count, revenue_total, discount_total, ...rest } = c;
    const { error } = await supabase.from("coupons").update(rest).eq("id", id);
    setSaving(false);
    error ? toast.error(error.message) : toast.success(ar ? "تم الحفظ" : "Saved");
  };

  return (
    <DetailShell
      backTo="/admin/coupons"
      backLabel={{ ar: "الكوبونات", en: "Coupons" }}
      title={c ? c.code : ""}
      description={c ? { ar: c.name ?? "", en: c.name ?? "" } : undefined}
      loading={loading}
      notFound={!loading && !c}
      actions={
        c && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
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
              <Field label={ar ? "الكود" : "Code"}>
                <TextInput value={c.code ?? ""} onChange={(e) => u("code", e.target.value)} />
              </Field>
              <Field label={ar ? "الاسم" : "Name"}>
                <TextInput value={c.name ?? ""} onChange={(e) => u("name", e.target.value)} />
              </Field>
              <Field label={ar ? "الوصف" : "Description"}>
                <TextArea value={c.description ?? ""} onChange={(e) => u("description", e.target.value)} />
              </Field>
              <Toggle checked={!!c.is_active} onChange={(v) => u("is_active", v)} label={ar ? "نشط" : "Active"} />
            </div>
          </Section>

          <Section title={ar ? "الخصم" : "Discount"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "النوع" : "Type"}>
                <Select value={c.discount_type ?? "percent"} onChange={(e) => u("discount_type", e.target.value)}>
                  <option value="percent">{ar ? "نسبة %" : "Percent %"}</option>
                  <option value="fixed">{ar ? "ثابت" : "Fixed"}</option>
                  <option value="free_shipping">{ar ? "شحن مجاني" : "Free shipping"}</option>
                </Select>
              </Field>
              <Field label={ar ? "القيمة" : "Value"}>
                <TextInput type="number" value={c.discount_value ?? 0} onChange={(e) => u("discount_value", parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label={ar ? "الحد الأدنى للسلة" : "Min subtotal"}>
                <TextInput type="number" value={c.min_subtotal ?? 0} onChange={(e) => u("min_subtotal", parseFloat(e.target.value) || 0)} />
              </Field>
            </div>
          </Section>

          <Section title={ar ? "القيود" : "Limits"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={ar ? "الحد الأقصى للاستخدامات" : "Max uses"}>
                <TextInput type="number" value={c.max_uses ?? ""} onChange={(e) => u("max_uses", e.target.value === "" ? null : parseInt(e.target.value))} />
              </Field>
              <Field label={ar ? "حد لكل عميل" : "Per customer limit"}>
                <TextInput type="number" value={c.per_customer_limit ?? ""} onChange={(e) => u("per_customer_limit", e.target.value === "" ? null : parseInt(e.target.value))} />
              </Field>
              <Toggle checked={!!c.first_order_only} onChange={(v) => u("first_order_only", v)} label={ar ? "أول طلب فقط" : "First order only"} />
            </div>
          </Section>

          <Section title={ar ? "المدة" : "Validity"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "يبدأ" : "Starts at"}>
                <TextInput type="datetime-local" value={c.starts_at ? c.starts_at.slice(0, 16) : ""} onChange={(e) => u("starts_at", e.target.value || null)} />
              </Field>
              <Field label={ar ? "ينتهي" : "Expires at"}>
                <TextInput type="datetime-local" value={c.expires_at ? c.expires_at.slice(0, 16) : ""} onChange={(e) => u("expires_at", e.target.value || null)} />
              </Field>
            </div>
          </Section>

          <Section title={ar ? "إحصائيات" : "Stats"}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">{ar ? "استُخدم" : "Used"}</div>
                <div className="mt-1 text-lg font-semibold">{c.used_count ?? 0}</div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">{ar ? "خصومات" : "Discounted"}</div>
                <div className="mt-1 text-lg font-semibold">{(c.discount_total ?? 0).toLocaleString()}</div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">{ar ? "إيرادات" : "Revenue"}</div>
                <div className="mt-1 text-lg font-semibold">{(c.revenue_total ?? 0).toLocaleString()}</div>
              </div>
            </div>
          </Section>
        </div>
      )}
    </DetailShell>
  );
}
