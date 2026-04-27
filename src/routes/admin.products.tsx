import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
});

const empty = {
  slug: "",
  name_en: "",
  name_ar: "",
  brand: "",
  description_en: "",
  description_ar: "",
  price: 0,
  currency: "SAR",
  image_url: "",
  stock: 0,
  category_id: "",
  is_active: true,
  sizes: [] as string[],
  colors: [] as string[],
};

function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data ?? []);
  }
  async function loadCats() {
    const { data } = await supabase.from("categories").select("*").order("display_order");
    setCategories(data ?? []);
  }
  useEffect(() => {
    load();
    loadCats();
  }, []);

  function startNew() {
    setForm(empty);
    setEditing({});
  }
  function startEdit(p: any) {
    setForm({
      ...empty,
      ...p,
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      colors: Array.isArray(p.colors) ? p.colors : [],
      category_id: p.category_id ?? "",
    });
    setEditing(p);
  }

  async function save() {
    const payload: any = {
      slug: form.slug,
      name_en: form.name_en,
      name_ar: form.name_ar,
      brand: form.brand || null,
      description_en: form.description_en || null,
      description_ar: form.description_ar || null,
      price: Number(form.price),
      currency: form.currency || "SAR",
      image_url: form.image_url || null,
      stock: Number(form.stock),
      category_id: form.category_id || null,
      is_active: !!form.is_active,
      sizes: form.sizes,
      colors: form.colors,
    };
    if (editing?.id) {
      await supabase.from("products").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("products").insert(payload);
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("حذف المنتج؟")) return;
    await supabase.from("products").delete().eq("id", id);
    await load();
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">المنتجات</h1>
        <button onClick={startNew} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          + إضافة منتج
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-3">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="h-40 w-full rounded-md object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                لا توجد صورة
              </div>
            )}
            <div className="mt-3">
              <div className="text-sm font-medium">{p.name_ar || p.name_en}</div>
              <div className="text-xs text-muted-foreground">{p.brand}</div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>{Number(p.price).toFixed(2)} {p.currency}</span>
                <span className={`text-xs ${p.is_active ? "text-green-600" : "text-muted-foreground"}`}>
                  {p.is_active ? "نشط" : "مخفي"} · {p.stock} قطعة
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="flex-1 rounded-md border border-border py-1.5 text-xs"
                >
                  تعديل
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">لا توجد منتجات. أضف أول منتج.</p>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">{editing?.id ? "تعديل منتج" : "منتج جديد"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Slug (مثل: silk-shirt)" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
              <Select
                label="الفئة"
                value={form.category_id}
                onChange={(v) => setForm({ ...form, category_id: v })}
                options={[{ value: "", label: "—" }, ...categories.map((c) => ({ value: c.id, label: c.name_ar }))]}
              />
              <Input label="الاسم (عربي)" value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} />
              <Input label="الاسم (إنجليزي)" value={form.name_en} onChange={(v) => setForm({ ...form, name_en: v })} />
              <Input label="الماركة" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
              <Input label="السعر" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
              <Input label="المخزون" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} />
              <Input label="العملة" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
              <Input label="رابط الصورة" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} className="col-span-2" />
              <Input
                label="المقاسات (مفصولة بفاصلة)"
                value={form.sizes.join(",")}
                onChange={(v) => setForm({ ...form, sizes: v.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                className="col-span-2"
              />
              <Input
                label="الألوان (مفصولة بفاصلة)"
                value={form.colors.join(",")}
                onChange={(v) => setForm({ ...form, colors: v.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                className="col-span-2"
              />
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                نشط (يظهر في المتجر)
              </label>
              <Textarea label="الوصف (عربي)" value={form.description_ar} onChange={(v) => setForm({ ...form, description_ar: v })} className="col-span-2" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm">
                إلغاء
              </button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Input({ label, value, onChange, type = "text", className = "" }: { label: string; value: any; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
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
function Textarea({ label, value, onChange, className = "" }: any) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <textarea
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
function Select({ label, value, onChange, options, className = "" }: any) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
