import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Search, Plus, Filter, Download, Edit3, Trash2, Eye, EyeOff,
  Archive, Clock, AlertTriangle, Copy, Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/admin/products")({
  component: ProductsListPage,
});

type Product = {
  id: string;
  slug: string;
  sku: string | null;
  name_ar: string;
  name_en: string;
  brand: string | null;
  image_url: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  status: string;
  product_type: string;
  is_active: boolean;
  category_id: string | null;
  sales_count: number;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  hidden: "مخفي",
  archived: "أرشيف",
  coming_soon: "قادم قريباً",
  draft: "مسودة",
};
const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  hidden: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  archived: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  coming_soon: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const PAGE_SIZE = 50;

function ProductsListPage() {
  const navigate = useNavigate();
  const { canEditOrders, canManage } = useUserRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from("categories").select("id, name_ar, name_en").then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, categoryFilter, stockFilter]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search.trim()) {
      const s = search.trim();
      q = q.or(`name_ar.ilike.%${s}%,name_en.ilike.%${s}%,sku.ilike.%${s}%,slug.ilike.%${s}%,brand.ilike.%${s}%`);
    }
    if (statusFilter) q = q.eq("status", statusFilter);
    if (categoryFilter) q = q.eq("category_id", categoryFilter);
    if (stockFilter === "out") q = q.lte("stock", 0);
    if (stockFilter === "low") q = q.gt("stock", 0).lte("stock", 5);
    if (stockFilter === "in") q = q.gt("stock", 5);

    const { data, count } = await q;
    setProducts((data as Product[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function selectAll() {
    setSelected((prev) => prev.size === products.length ? new Set() : new Set(products.map((p) => p.id)));
  }

  async function bulkUpdate(patch: Partial<Product>) {
    if (selected.size === 0) return;
    if (!canEditOrders) return;
    await (supabase.from("products") as any).update(patch).in("id", Array.from(selected));
    setSelected(new Set());
    load();
  }

  async function bulkDelete() {
    if (selected.size === 0 || !canManage) return;
    if (!confirm(`حذف ${selected.size} منتج نهائياً؟`)) return;
    await supabase.from("products").delete().in("id", Array.from(selected));
    setSelected(new Set());
    load();
  }

  async function duplicate(p: Product) {
    if (!canEditOrders) return;
    const { data: full } = await supabase.from("products").select("*").eq("id", p.id).single();
    if (!full) return;
    const { id, created_at, updated_at, sku, slug, ...rest } = full as any;
    const { data: created } = await (supabase.from("products") as any).insert({
      ...rest,
      sku: sku ? `${sku}-COPY-${Date.now().toString(36)}` : null,
      slug: `${slug}-copy-${Date.now().toString(36)}`,
      name_ar: `${rest.name_ar} (نسخة)`,
      status: "draft",
      sales_count: 0,
    }).select().single();
    if (created) navigate({ to: "/admin/products/$id", params: { id: (created as any).id } });
  }

  function exportCsv() {
    const headers = ["SKU","الاسم","القسم","السعر","المخزون","الحالة","المبيعات","تاريخ الإنشاء"];
    const rows = products.map((p) => [
      p.sku ?? "", p.name_ar, p.category_id ?? "", p.price, p.stock,
      STATUS_LABEL[p.status] ?? p.status, p.sales_count, new Date(p.created_at).toLocaleDateString("ar-SA"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `products-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">المنتجات</h1>
          <p className="mt-1 text-sm text-muted-foreground">إجمالي: {total}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
            <Download className="h-4 w-4" /> تصدير CSV
          </button>
          {canEditOrders && (
            <Link to="/admin/products/$id" params={{ id: "new" }} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> منتج جديد
            </Link>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="mt-4 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="ابحث بالاسم، SKU، slug، أو العلامة..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-input bg-background py-2 pe-9 ps-3 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <Filter className="h-4 w-4" /> فلاتر
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">كل الأقسام</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar || c.name_en}</option>)}
            </select>
            <select value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(0); }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">كل المخزون</option>
              <option value="in">متوفر</option>
              <option value="low">مخزون منخفض (≤5)</option>
              <option value="out">نفد</option>
            </select>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} محدد</span>
          <button onClick={() => bulkUpdate({ status: "active" } as any)} className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent">نشط</button>
          <button onClick={() => bulkUpdate({ status: "hidden" } as any)} className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent">إخفاء</button>
          <button onClick={() => bulkUpdate({ status: "archived" } as any)} className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent">أرشيف</button>
          {canManage && (
            <button onClick={bulkDelete} className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20">
              حذف نهائي
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="ms-auto text-xs text-muted-foreground hover:text-foreground">إلغاء التحديد</button>
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-right">
                  <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={selectAll} />
                </th>
                <th className="p-3 text-right">الصورة</th>
                <th className="p-3 text-right">الاسم / SKU</th>
                <th className="p-3 text-right">القسم</th>
                <th className="p-3 text-right">السعر</th>
                <th className="p-3 text-right">المخزون</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">المبيعات</th>
                <th className="p-3 text-right">آخر تحديث</th>
                <th className="p-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
              )}
              {!loading && products.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">لا توجد منتجات</td></tr>
              )}
              {products.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id);
                const lowStock = p.stock > 0 && p.stock <= (p.low_stock_threshold ?? 5);
                const outOfStock = p.stock <= 0;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-accent/30">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="p-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name_ar} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Link to="/admin/products/$id" params={{ id: p.id }} className="font-medium hover:underline">
                        {p.name_ar || p.name_en}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.sku ?? p.slug}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{cat?.name_ar ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div>{Number(p.price).toFixed(2)} ر.س</div>
                      {p.compare_at_price && (
                        <div className="text-xs text-muted-foreground line-through">{Number(p.compare_at_price).toFixed(2)}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 ${outOfStock ? "text-destructive" : lowStock ? "text-amber-600" : ""}`}>
                        {(outOfStock || lowStock) && <AlertTriangle className="h-3 w-3" />}
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[p.status] ?? STATUS_COLOR.draft}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{p.sales_count}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.updated_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Link to="/admin/products/$id" params={{ id: p.id }} title="تعديل" className="rounded p-1.5 hover:bg-accent">
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        {canEditOrders && (
                          <button onClick={() => duplicate(p)} title="نسخ" className="rounded p-1.5 hover:bg-accent">
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          صفحة {page + 1} من {totalPages}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="rounded-md border border-border bg-background px-3 py-1.5 disabled:opacity-50">السابق</button>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="rounded-md border border-border bg-background px-3 py-1.5 disabled:opacity-50">التالي</button>
        </div>
      </div>
    </AdminShell>
  );
}
