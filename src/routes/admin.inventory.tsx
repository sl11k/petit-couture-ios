import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { Save, AlertTriangle, Package as PackageIcon } from "lucide-react";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryAdmin,
});

type Product = {
  id: string;
  name_ar: string;
  name_en: string;
  stock: number;
  price: number;
  image_url: string | null;
  is_active: boolean;
};

type Alert = {
  id: string;
  product_id: string;
  email: string | null;
  phone: string | null;
  notified: boolean;
  created_at: string;
};

function InventoryAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "low" | "out">("low");
  const [tab, setTab] = useState<"stock" | "alerts">("stock");

  async function load() {
    const [pRes, aRes] = await Promise.all([
      supabase.from("products").select("*").order("stock", { ascending: true }).limit(200),
      supabase.from("inventory_alerts").select("*").eq("notified", false).order("created_at", { ascending: false }).limit(100),
    ]);
    setProducts((pRes.data ?? []) as Product[]);
    setAlerts((aRes.data ?? []) as Alert[]);
  }
  useEffect(() => { void load(); }, []);

  const filtered = products.filter((p) => {
    if (filter === "low") return p.stock <= 5;
    if (filter === "out") return p.stock === 0;
    return true;
  });

  async function saveStock(id: string) {
    const v = Number(stockEdits[id]);
    if (Number.isNaN(v) || v < 0) return;
    await supabase.from("products").update({ stock: v }).eq("id", id);
    setStockEdits((s) => { const n = { ...s }; delete n[id]; return n; });
    await load();
  }

  async function markNotified(id: string) {
    await supabase.from("inventory_alerts").update({ notified: true }).eq("id", id);
    await load();
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">المخزون</h1>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-xs">
          {([["stock", "المخزون"], ["alerts", `طلبات إشعار (${alerts.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded px-3 py-1 ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "stock" && (
        <>
          <div className="mb-3 flex gap-1 rounded-md border border-border bg-card p-1 text-xs">
            {([["all", "الكل"], ["low", "منخفض ≤5"], ["out", "نفد"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded px-3 py-1 ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{l}</button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">المنتج</th>
                  <th className="p-3">السعر</th>
                  <th className="p-3">المخزون</th>
                  <th className="p-3">تعديل</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.image_url && <img src={p.image_url} className="h-9 w-9 rounded object-cover" alt="" />}
                        <div>
                          <div className="text-xs font-medium">{p.name_ar}</div>
                          <div className="text-[11px] text-muted-foreground">{p.name_en}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{p.price} ر.س</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        p.stock === 0 ? "bg-destructive/10 text-destructive" :
                        p.stock <= 5 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                      }`}>{p.stock}</span>
                    </td>
                    <td className="p-3">
                      <input type="number" min={0}
                        defaultValue={p.stock}
                        onChange={(e) => setStockEdits({ ...stockEdits, [p.id]: e.target.value })}
                        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </td>
                    <td className="p-3">
                      {stockEdits[p.id] !== undefined && (
                        <button onClick={() => saveStock(p.id)} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground">
                          <Save className="h-3 w-3" /> حفظ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">لا توجد منتجات</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "alerts" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">المنتج</th>
                <th className="p-3">العميل</th>
                <th className="p-3">المخزون الحالي</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const p = productMap.get(a.product_id);
                return (
                  <tr key={a.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 text-xs">{p?.name_ar ?? <span className="text-muted-foreground">منتج محذوف</span>}</td>
                    <td className="p-3 text-xs">{a.email ?? a.phone ?? "—"}</td>
                    <td className="p-3 text-xs">{p ? p.stock : "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ar")}</td>
                    <td className="p-3">
                      <button onClick={() => markNotified(a.id)} className="rounded-md border border-border px-2 py-1 text-[10px]">تم الإشعار</button>
                    </td>
                  </tr>
                );
              })}
              {alerts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground"><PackageIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />لا توجد طلبات إشعار</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
