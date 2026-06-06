import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { exportTableToCSV } from "@/features/admin/utils/exportTable";
import type { ColumnDef } from "@/features/admin/types";
import { Download, Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/size-skus")({
  component: SizeSkusPage,
});

type Row = {
  id: string;
  product: string;
  slug: string;
  size: string;
  sku: string;
  price: number | null;
  stock: number;
  active: string;
};

function SizeSkusPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("product_variants")
        .select("id, size, sku, price, stock, is_active, attributes, product_id, products(name_ar, name_en, slug)")
        .eq("attributes->>kind", "size")
        .order("product_id", { ascending: true })
        .order("sort_order", { ascending: true })
        .limit(5000);
      if (!alive) return;
      const mapped: Row[] = ((data ?? []) as any[])
        .filter((v) => v?.attributes?.kind === "size")
        .map((v) => ({
          id: v.id,
          product: (ar ? v.products?.name_ar : v.products?.name_en) || v.products?.name_en || v.products?.name_ar || "—",
          slug: v.products?.slug ?? "",
          size: String(v.size ?? "").trim(),
          sku: v.sku ?? "",
          price: v.price != null ? Number(v.price) : null,
          stock: Number(v.stock) || 0,
          active: v.is_active === false ? (ar ? "لا" : "No") : (ar ? "نعم" : "Yes"),
        }));
      setRows(mapped);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [ar]);

  const columns: ColumnDef<Row>[] = useMemo(() => [
    { key: "product", label: { ar: "المنتج", en: "Product" } },
    { key: "size", label: { ar: "المقاس", en: "Size" } },
    { key: "sku", label: { ar: "SKU", en: "SKU" } },
    { key: "price", label: { ar: "السعر", en: "Price" }, type: "currency" },
    { key: "stock", label: { ar: "المخزون", en: "Stock" }, type: "number" },
    { key: "active", label: { ar: "متاح", en: "Active" } },
  ], []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      r.product.toLowerCase().includes(term) ||
      r.sku.toLowerCase().includes(term) ||
      r.size.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const totalStock = useMemo(() => filtered.reduce((s, r) => s + r.stock, 0), [filtered]);

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={{ ar: "أكواد المقاسات", en: "Size SKUs" }}
        description={{ ar: "كل كود (SKU) لكل مقاس عبر جميع المنتجات — قابل للبحث والتصدير.", en: "Every per-size SKU across all products — searchable and exportable." }}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "بحث بالمنتج أو المقاس أو SKU..." : "Search product, size or SKU..."}
            className="h-9 w-full rounded-md border border-border bg-background ps-9 pe-3 text-sm outline-none focus:border-gold"
          />
        </div>
        <button
          type="button"
          onClick={() => exportTableToCSV(filtered, columns, "size-skus", ar ? "ar" : "en")}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> {ar ? "تصدير CSV" : "Export CSV"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <span>{ar ? `${filtered.length} مقاس` : `${filtered.length} sizes`}</span>
          <span>{ar ? `المخزون الكلي: ${totalStock}` : `Total stock: ${totalStock}`}</span>
        </div>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارِ التحميل..." : "Loading..."}</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{ar ? "لا توجد أكواد مقاسات." : "No size SKUs yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-start text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start font-medium">{ar ? "المنتج" : "Product"}</th>
                  <th className="p-2 text-start font-medium">{ar ? "المقاس" : "Size"}</th>
                  <th className="p-2 text-start font-medium">SKU</th>
                  <th className="p-2 text-start font-medium">{ar ? "السعر" : "Price"}</th>
                  <th className="p-2 text-start font-medium">{ar ? "المخزون" : "Stock"}</th>
                  <th className="p-2 text-start font-medium">{ar ? "متاح" : "Active"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">{r.product}</td>
                    <td className="p-2">{r.size}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">{r.sku || "—"}</td>
                    <td className="p-2 tabular-nums">{r.price != null ? r.price.toFixed(2) : "—"}</td>
                    <td className="p-2 tabular-nums">{r.stock}</td>
                    <td className="p-2">{r.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
