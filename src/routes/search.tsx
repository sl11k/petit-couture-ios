import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { SlidersHorizontal, Star, X } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { searchProducts, fetchFacets, logSearch, spellSuggest, type SortKey } from "@/lib/search";

const searchSchema = z.object({
  q: z.string().optional().catch(""),
  cat: z.string().optional().catch(""),
  brand: z.string().optional().catch(""),
  color: z.string().optional().catch(""),
  size: z.string().optional().catch(""),
  pmin: z.coerce.number().optional().catch(undefined),
  pmax: z.coerce.number().optional().catch(undefined),
  rating: z.coerce.number().optional().catch(undefined),
  stock: z.coerce.boolean().optional().catch(false),
  sort: z.string().optional().catch("relevance"),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "بحث - Golden Boutique" },
      { name: "description", content: "ابحث في كافة المنتجات والأقسام والعلامات التجارية" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
});

const SORT_OPTIONS: { key: SortKey; label_ar: string; label_en: string }[] = [
  { key: "relevance", label_ar: "الأكثر صلة", label_en: "Relevance" },
  { key: "best_selling", label_ar: "الأكثر مبيعًا", label_en: "Best selling" },
  { key: "price_asc", label_ar: "السعر: من الأقل", label_en: "Price: low to high" },
  { key: "price_desc", label_ar: "السعر: من الأعلى", label_en: "Price: high to low" },
  { key: "newest", label_ar: "الأحدث", label_en: "Newest" },
  { key: "top_rated", label_ar: "الأعلى تقييمًا", label_en: "Top rated" },
  { key: "most_viewed", label_ar: "الأكثر مشاهدة", label_en: "Most viewed" },
];

function csv(s?: string) { return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean); }

function SearchPage() {
  const sp = Route.useSearch() as any;
  const isRTL = true;

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<any>({ categories: [], brands: [], colors: [], sizes: [], priceRange: { min: 0, max: 1000 } });
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [openFilters, setOpenFilters] = useState(false);

  const filters = useMemo(() => ({
    q: sp.q ?? "",
    categoryIds: csv(sp.cat),
    brands: csv(sp.brand),
    colors: csv(sp.color),
    sizes: csv(sp.size),
    priceMin: sp.pmin,
    priceMax: sp.pmax,
    minRating: sp.rating,
    inStockOnly: !!sp.stock,
    sort: (sp.sort ?? "relevance") as SortKey,
  }), [sp]);

  useEffect(() => { fetchFacets().then(setFacets); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await searchProducts(filters);
      if (cancelled) return;
      setItems(res.items);
      setTotal(res.total);
      setLoading(false);
      logSearch(filters.q ?? "", res.items.length);
      if (res.items.length === 0 && filters.q) {
        const s = await spellSuggest(filters.q);
        if (!cancelled) setDidYouMean(s);
      } else {
        setDidYouMean(null);
      }
    })();
    return () => { cancelled = true; };
  }, [filters]);

  function setParam(key: string, value: any) {
    const next = { ...sp, [key]: value };
    if (value === "" || value === undefined || value === false) delete next[key];
    const qs = new URLSearchParams(next as any).toString();
    window.history.replaceState({}, "", `/search?${qs}`);
    // re-trigger via routing
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function toggleArrayParam(key: string, val: string) {
    const cur = csv((sp as any)[key]);
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    setParam(key, next.join(","));
  }

  const activeChips: { label: string; onRemove: () => void }[] = [];
  csv(sp.cat).forEach((id) => {
    const c = facets.categories.find((x: any) => x.id === id);
    if (c) activeChips.push({ label: c.name_ar, onRemove: () => toggleArrayParam("cat", id) });
  });
  csv(sp.brand).forEach((b) => activeChips.push({ label: b, onRemove: () => toggleArrayParam("brand", b) }));
  csv(sp.color).forEach((c) => activeChips.push({ label: c, onRemove: () => toggleArrayParam("color", c) }));
  csv(sp.size).forEach((s) => activeChips.push({ label: s, onRemove: () => toggleArrayParam("size", s) }));
  if (sp.pmin || sp.pmax) activeChips.push({ label: `${sp.pmin ?? 0} - ${sp.pmax ?? "∞"} SAR`, onRemove: () => { setParam("pmin", undefined); setParam("pmax", undefined); } });
  if (sp.rating) activeChips.push({ label: `${sp.rating}★+`, onRemove: () => setParam("rating", undefined) });
  if (sp.stock) activeChips.push({ label: isRTL ? "متوفر فقط" : "In stock", onRemove: () => setParam("stock", undefined) });

  const Sidebar = (
    <aside className="space-y-5 text-sm" dir={isRTL ? "rtl" : "ltr"}>
      <FilterGroup title={isRTL ? "السعر" : "Price"}>
        <div className="flex gap-2">
          <input type="number" placeholder="Min" defaultValue={sp.pmin}
            onBlur={(e) => setParam("pmin", e.target.value || undefined)}
            className="w-1/2 h-9 px-2 rounded border bg-background" />
          <input type="number" placeholder="Max" defaultValue={sp.pmax}
            onBlur={(e) => setParam("pmax", e.target.value || undefined)}
            className="w-1/2 h-9 px-2 rounded border bg-background" />
        </div>
      </FilterGroup>

      <FilterGroup title={isRTL ? "القسم" : "Category"}>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {facets.categories.map((c: any) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={csv(sp.cat).includes(c.id)} onChange={() => toggleArrayParam("cat", c.id)} />
              <span>{isRTL ? c.name_ar : c.name_en}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      {facets.brands.length > 0 && (
        <FilterGroup title={isRTL ? "العلامة التجارية" : "Brand"}>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {facets.brands.map((b: string) => (
              <label key={b} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={csv(sp.brand).includes(b)} onChange={() => toggleArrayParam("brand", b)} />
                <span>{b}</span>
              </label>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.colors.length > 0 && (
        <FilterGroup title={isRTL ? "اللون" : "Color"}>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c: string) => (
              <button key={c} onClick={() => toggleArrayParam("color", c)}
                className={`px-3 h-8 rounded-full border text-xs ${csv(sp.color).includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                {c}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.sizes.length > 0 && (
        <FilterGroup title={isRTL ? "المقاس" : "Size"}>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s: string) => (
              <button key={s} onClick={() => toggleArrayParam("size", s)}
                className={`px-3 h-8 min-w-10 rounded border text-xs ${csv(sp.size).includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                {s}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={isRTL ? "التقييم" : "Rating"}>
        <div className="flex flex-col gap-1">
          {[4, 3, 2, 1].map((r) => (
            <button key={r} onClick={() => setParam("rating", sp.rating === r ? undefined : r)}
              className={`flex items-center gap-1 text-start py-1 ${sp.rating === r ? "text-primary font-semibold" : ""}`}>
              {Array.from({ length: r }).map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
              <span className="text-xs ms-1">{isRTL ? "وأعلى" : "& up"}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={isRTL ? "التوفر" : "Availability"}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!sp.stock} onChange={(e) => setParam("stock", e.target.checked || undefined)} />
          <span>{isRTL ? "متوفر فقط" : "In stock only"}</span>
        </label>
      </FilterGroup>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <SearchBar isRTL={isRTL} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[260px_1fr] gap-6">
        <div className="hidden lg:block">{Sidebar}</div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">
                {sp.q ? (isRTL ? `نتائج: "${sp.q}"` : `Results for "${sp.q}"`) : (isRTL ? "كل المنتجات" : "All products")}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">{total} {isRTL ? "نتيجة" : "results"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setOpenFilters(true)} className="lg:hidden inline-flex items-center gap-1 px-3 h-9 border rounded-md text-sm">
                <SlidersHorizontal className="h-4 w-4" /> {isRTL ? "فلترة" : "Filter"}
              </button>
              <select value={sp.sort ?? "relevance"} onChange={(e) => setParam("sort", e.target.value)}
                className="h-9 px-2 rounded-md border bg-background text-sm">
                {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{isRTL ? o.label_ar : o.label_en}</option>)}
              </select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeChips.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 h-7 bg-muted rounded-full text-xs">
                  {c.label}
                  <button onClick={c.onRemove}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg mb-2">{isRTL ? "لا توجد نتائج" : "No results"}</p>
              {didYouMean && (
                <button onClick={() => setParam("q", didYouMean)} className="text-primary hover:underline">
                  {isRTL ? `هل تقصد: ${didYouMean}؟` : `Did you mean: ${didYouMean}?`}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((p) => (
                <Link key={p.id} to="/" className="group block bg-card rounded-lg overflow-hidden border border-border hover:shadow-md transition">
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.image_url && <img src={p.image_url} alt={p.name_ar} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium line-clamp-2">{isRTL ? p.name_ar : p.name_en}</div>
                    {p.brand && <div className="text-xs text-muted-foreground mt-0.5">{p.brand}</div>}
                    <div className="mt-2 font-bold text-sm">{p.price} {p.currency || "SAR"}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {openFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenFilters(false)} />
          <div className={`absolute top-0 ${isRTL ? "right-0" : "left-0"} h-full w-[85%] max-w-sm bg-background p-4 overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">{isRTL ? "فلترة" : "Filters"}</h2>
              <button onClick={() => setOpenFilters(false)}><X className="h-5 w-5" /></button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      {children}
    </div>
  );
}
