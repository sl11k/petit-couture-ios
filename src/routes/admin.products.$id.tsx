import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = useParams({ from: "/admin/products/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      setProduct(data);
      setLoading(false);
    })();
  }, [id]);

  function update<K extends string>(key: K, value: any) {
    setProduct((p: any) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const { id: _, created_at, updated_at, ...rest } = product;
    const { error } = await supabase.from("products").update(rest).eq("id", id);
    setSaving(false);
    if (error) alert(error.message);
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  }
  if (!product) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{ar ? "المنتج غير موجود" : "Product not found"}</p>
        <Link to="/admin/products" className="mt-3 inline-block text-sm text-primary underline">
          {ar ? "العودة للمنتجات" : "Back to products"}
        </Link>
      </div>
    );
  }

  const Arrow = ar ? ArrowRight : ArrowLeft;

  return (
    <div>
      <Link to="/admin/products" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Arrow className="h-3 w-3" /> {ar ? "العودة للمنتجات" : "Back to products"}
      </Link>

      <PageHeader
        title={ar ? product.name_ar : product.name_en}
        actions={
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> {saving ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ" : "Save"}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "البيانات الأساسية" : "Basic info"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={ar ? "الاسم العربي" : "Name (AR)"} value={product.name_ar ?? ""} onChange={(v) => update("name_ar", v)} />
              <Input label={ar ? "الاسم الإنجليزي" : "Name (EN)"} value={product.name_en ?? ""} onChange={(v) => update("name_en", v)} />
              <Input label={ar ? "السعر" : "Price"} type="number" value={product.price ?? 0} onChange={(v) => update("price", Number(v))} />
              <Input label={ar ? "المخزون" : "Stock"} type="number" value={product.stock ?? 0} onChange={(v) => update("stock", Number(v))} />
              <Textarea label={ar ? "الوصف العربي" : "Description (AR)"} value={product.description_ar ?? ""} onChange={(v) => update("description_ar", v)} />
              <Textarea label={ar ? "الوصف الإنجليزي" : "Description (EN)"} value={product.description_en ?? ""} onChange={(v) => update("description_en", v)} />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "الصورة" : "Image"}</h2>
            {product.image_url && <img src={product.image_url} className="mb-3 w-full rounded object-cover" alt="" />}
            <Input label={ar ? "رابط الصورة" : "Image URL"} value={product.image_url ?? ""} onChange={(v) => update("image_url", v)} />
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "الإعدادات" : "Settings"}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!product.is_active}
                onChange={(e) => update("is_active", e.target.checked)}
              />
              {ar ? "نشط" : "Active"}
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="sm:col-span-2">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}
