import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { Plus, Trash2, Pencil, Save, X, Copy } from "lucide-react";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsAdmin,
});

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_subtotal: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

function CouponsAdmin() {
  const [list, setList] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);

  async function load() {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Coupon[]);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!editing?.code) return alert("الكود مطلوب");
    const payload = {
      code: editing.code.toUpperCase(),
      description: editing.description ?? null,
      discount_type: editing.discount_type ?? "percent",
      discount_value: Number(editing.discount_value ?? 0),
      min_subtotal: editing.min_subtotal ? Number(editing.min_subtotal) : null,
      max_uses: editing.max_uses ? Number(editing.max_uses) : null,
      expires_at: editing.expires_at || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("coupons").update(payload).eq("id", editing.id)
      : await supabase.from("coupons").insert(payload);
    if (error) return alert(error.message);
    setEditing(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm("حذف هذا الكوبون؟")) return;
    await supabase.from("coupons").delete().eq("id", id);
    await load();
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">الكوبونات ({list.length})</h1>
        <button onClick={() => setEditing({ discount_type: "percent", is_active: true, discount_value: 10 })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> كوبون جديد
        </button>
      </div>

      {editing && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="الكود" value={editing.code ?? ""} onChange={(v) => setEditing({ ...editing, code: v.toUpperCase() })} />
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">نوع الخصم</span>
              <select value={editing.discount_type ?? "percent"}
                onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="percent">نسبة %</option>
                <option value="fixed">مبلغ ثابت</option>
                <option value="free_shipping">شحن مجاني</option>
              </select>
            </label>
            <Input label="قيمة الخصم" type="number" value={String(editing.discount_value ?? 0)} onChange={(v) => setEditing({ ...editing, discount_value: Number(v) })} />
            <Input label="حد أدنى للسلة" type="number" value={String(editing.min_subtotal ?? "")} onChange={(v) => setEditing({ ...editing, min_subtotal: v ? Number(v) : null })} />
            <Input label="عدد الاستخدامات الأقصى" type="number" value={String(editing.max_uses ?? "")} onChange={(v) => setEditing({ ...editing, max_uses: v ? Number(v) : null })} />
            <Input label="ينتهي في" type="datetime-local" value={editing.expires_at?.slice(0, 16) ?? ""} onChange={(v) => setEditing({ ...editing, expires_at: v })} />
            <Input label="الوصف" value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} />
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              نشط
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Save className="h-3.5 w-3.5" /> حفظ</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" /> إلغاء</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-3">الكود</th>
              <th className="p-3">الخصم</th>
              <th className="p-3">الحد الأدنى</th>
              <th className="p-3">الاستخدام</th>
              <th className="p-3">الصلاحية</th>
              <th className="p-3">الحالة</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              return (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <button onClick={() => navigator.clipboard.writeText(c.code)} className="flex items-center gap-1 font-mono text-xs hover:text-primary">
                      {c.code} <Copy className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="p-3 text-xs">
                    {c.discount_type === "percent" && `${c.discount_value}%`}
                    {c.discount_type === "fixed" && `${c.discount_value} ر.س`}
                    {c.discount_type === "free_shipping" && "شحن مجاني"}
                  </td>
                  <td className="p-3 text-xs">{c.min_subtotal ? `${c.min_subtotal} ر.س` : "—"}</td>
                  <td className="p-3 text-xs">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                  <td className="p-3 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar") : "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                      !c.is_active ? "bg-gray-100 text-gray-700" :
                      expired ? "bg-red-100 text-red-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {!c.is_active ? "معطل" : expired ? "منتهي" : "نشط"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(c)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(c.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">لا توجد كوبونات</td></tr>}
          </tbody>
        </table>
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
