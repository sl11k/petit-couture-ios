import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesAdmin,
});

type Cat = {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
};

function CategoriesAdmin() {
  const [list, setList] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true });
    setList((data ?? []) as Cat[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!editing?.name_ar || !editing?.slug) return alert("الاسم العربي والـ slug مطلوبان");
    const payload = {
      name_ar: editing.name_ar,
      name_en: editing.name_en ?? editing.name_ar,
      slug: editing.slug,
      display_order: editing.display_order ?? 0,
      is_active: editing.is_active ?? true,
      image_url: editing.image_url ?? null,
    };
    if (editing.id) {
      await supabase.from("categories").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("categories").insert(payload);
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا القسم؟")) return;
    await supabase.from("categories").delete().eq("id", id);
    await load();
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">الأقسام ({list.length})</h1>
        <button
          onClick={() => setEditing({ display_order: list.length, is_active: true })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> قسم جديد
        </button>
      </div>

      {editing && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="الاسم بالعربية" value={editing.name_ar ?? ""} onChange={(v) => setEditing({ ...editing, name_ar: v })} />
            <Input label="الاسم بالإنجليزية" value={editing.name_en ?? ""} onChange={(v) => setEditing({ ...editing, name_en: v })} />
            <Input label="الرابط (slug)" value={editing.slug ?? ""} onChange={(v) => setEditing({ ...editing, slug: v })} />
            <Input label="الترتيب" type="number" value={String(editing.display_order ?? 0)} onChange={(v) => setEditing({ ...editing, display_order: Number(v) })} />
            <Input label="رابط الصورة" value={editing.image_url ?? ""} onChange={(v) => setEditing({ ...editing, image_url: v })} />
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              نشط
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              <Save className="h-3.5 w-3.5" /> حفظ
            </button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs">
              <X className="h-3.5 w-3.5" /> إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">الترتيب</th>
                <th className="p-3">الصورة</th>
                <th className="p-3">الاسم</th>
                <th className="p-3">الرابط</th>
                <th className="p-3">الحالة</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3 text-xs">{c.display_order}</td>
                  <td className="p-3">{c.image_url && <img src={c.image_url} alt="" className="h-10 w-10 rounded object-cover" />}</td>
                  <td className="p-3 font-medium">{c.name_ar}<div className="text-[11px] text-muted-foreground">{c.name_en}</div></td>
                  <td className="p-3 font-mono text-xs">/{c.slug}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[10px] ${c.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{c.is_active ? "نشط" : "معطل"}</span></td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(c)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(c.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">لا توجد أقسام</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
  );
}
