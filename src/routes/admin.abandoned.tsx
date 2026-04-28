import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { Mail, Phone, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/abandoned")({
  component: AbandonedAdmin,
});

type Cart = {
  id: string;
  email: string | null;
  phone: string | null;
  subtotal: number;
  currency: string;
  items: any;
  reached_checkout: boolean;
  converted: boolean;
  created_at: string;
  updated_at: string;
};

function AbandonedAdmin() {
  const [list, setList] = useState<Cart[]>([]);
  const [filter, setFilter] = useState<"all" | "checkout" | "with_contact">("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase.from("abandoned_carts").select("*").eq("converted", false).order("updated_at", { ascending: false }).limit(200);
    if (filter === "checkout") q = q.eq("reached_checkout", true);
    if (filter === "with_contact") q = q.or("email.not.is.null,phone.not.is.null");
    const { data } = await q;
    setList((data ?? []) as Cart[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [filter]);

  async function remove(id: string) {
    if (!confirm("حذف هذه السلة؟")) return;
    await supabase.from("abandoned_carts").delete().eq("id", id);
    await load();
  }

  const totalValue = list.reduce((s, c) => s + Number(c.subtotal ?? 0), 0);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">السلات المتروكة ({list.length})</h1>
          <p className="text-xs text-muted-foreground">قيمة محتملة: {totalValue.toLocaleString("ar-SA")} ر.س</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-xs">
          {([["all", "الكل"], ["checkout", "وصل للدفع"], ["with_contact", "بمعلومات تواصل"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded px-3 py-1 ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">العميل</th>
                <th className="p-3">المنتجات</th>
                <th className="p-3">القيمة</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">آخر نشاط</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const itemCount = Array.isArray(c.items) ? c.items.length : 0;
                const wa = c.phone?.replace(/\D/g, "");
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{c.email}</div>}
                      {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.phone}</div>}
                      {!c.email && !c.phone && <span className="text-xs text-muted-foreground">زائر مجهول</span>}
                    </td>
                    <td className="p-3 text-xs">{itemCount} منتج</td>
                    <td className="p-3 font-medium">{Number(c.subtotal).toLocaleString("ar-SA")} ر.س</td>
                    <td className="p-3">
                      {c.reached_checkout
                        ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">وصل للدفع</span>
                        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">في السلة</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("ar")}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {wa && (
                          <a href={`https://wa.me/${wa}?text=${encodeURIComponent("مرحباً، لاحظنا أنك تركت بعض المنتجات في السلة. هل تحتاج مساعدة لإكمال الطلب؟")}`}
                            target="_blank" rel="noreferrer"
                            className="rounded bg-green-500 px-2 py-1 text-[10px] text-white">WhatsApp</a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}?subject=${encodeURIComponent("سلة التسوق الخاصة بك")}`}
                            className="rounded border border-border px-2 py-1 text-[10px]">Email</a>
                        )}
                        <button onClick={() => remove(c.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">لا توجد سلات متروكة</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
