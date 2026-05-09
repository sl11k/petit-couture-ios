import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Package, Plus, RefreshCw, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type Row = {
  id: string;
  sku: string | null;
  name_ar: string | null;
  name_en: string | null;
  image_url: string | null;
  stock: number;
  low_stock_threshold: number | null;
  supplier_email?: string | null;
};

export function LowStockAlerts() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id,sku,name_ar,name_en,image_url,stock,low_stock_threshold")
      .eq("is_active", true)
      .order("stock", { ascending: true })
      .limit(50);
    const filtered = (data ?? []).filter(
      (p: any) => Number(p.stock) <= Number(p.low_stock_threshold ?? 5),
    ) as Row[];
    setRows(filtered.slice(0, 8));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (r: Row) => {
    setEditing(r.id);
    setEditQty(String(r.stock));
  };

  const saveEdit = async (id: string) => {
    // Validate: integer 0..100000
    const n = Number(editQty);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100000) {
      toast.error(ar ? "كمية غير صالحة" : "Invalid quantity");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("products").update({ stock: n }).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(ar ? "تعذّر التحديث" : "Update failed");
      return;
    }
    toast.success(ar ? "تم تحديث الكمية" : "Quantity updated");
    setEditing(null);
    load();
  };

  const reorder = async (r: Row) => {
    // Lightweight "reorder" action: emit an admin notification + open mailto if supplier exists.
    const subject = encodeURIComponent(
      ar ? `طلب إعادة تخزين: ${r.name_ar || r.name_en || r.sku || ""}` : `Reorder request: ${r.name_en || r.name_ar || r.sku || ""}`,
    );
    const body = encodeURIComponent(
      ar
        ? `الرجاء تجهيز إعادة تخزين للمنتج التالي:\n\nSKU: ${r.sku ?? "-"}\nالاسم: ${r.name_ar ?? r.name_en ?? "-"}\nالمخزون الحالي: ${r.stock}\nالحد الأدنى: ${r.low_stock_threshold ?? 5}`
        : `Please prepare a restock for:\n\nSKU: ${r.sku ?? "-"}\nName: ${r.name_en ?? r.name_ar ?? "-"}\nCurrent stock: ${r.stock}\nThreshold: ${r.low_stock_threshold ?? 5}`,
    );
    try {
      window.open(`mailto:?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
    } catch { /* ignore */ }
    toast.success(ar ? "تم إنشاء طلب إعادة التخزين" : "Reorder draft created");
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-semibold">
            {ar ? "تنبيهات المخزون المنخفض" : "Low stock alerts"}
          </h3>
          {!loading && rows.length > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {rows.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label={ar ? "تحديث" : "Refresh"}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <Link to="/admin/inventory" className="text-xs text-primary hover:underline">
            {ar ? "إدارة المخزون" : "Manage inventory"}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Package className="mb-2 h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium">{ar ? "كل المنتجات بمستوى مخزون آمن" : "All products are at safe stock levels"}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const out = r.stock <= 0;
            const name = ar ? r.name_ar || r.name_en : r.name_en || r.name_ar;
            const isEditing = editing === r.id;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-md border border-border object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{name || r.sku || "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {r.sku && <span className="me-2 font-mono">{r.sku}</span>}
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          out
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {out ? (ar ? "نفذ" : "Out") : ar ? `متبقي ${r.stock}` : `${r.stock} left`}
                      </span>
                      <span className="ms-2 text-muted-foreground">
                        {ar ? `الحد ${r.low_stock_threshold ?? 5}` : `min ${r.low_stock_threshold ?? 5}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        step={1}
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs"
                      />
                      <button
                        onClick={() => saveEdit(r.id)}
                        disabled={saving}
                        className="h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : ar ? "حفظ" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted/50"
                      >
                        {ar ? "إلغاء" : "Cancel"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(r)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted/50"
                      >
                        <Pencil className="h-3 w-3" /> {ar ? "تعديل الكمية" : "Edit qty"}
                      </button>
                      <button
                        onClick={() => reorder(r)}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <Plus className="h-3 w-3" /> {ar ? "إعادة الطلب" : "Reorder"}
                      </button>
                      <Link
                        to="/admin/products/$id"
                        params={{ id: r.id }}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        aria-label={ar ? "فتح المنتج" : "Open product"}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
