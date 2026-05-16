import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { SlidersHorizontal, Star, X, Search as SearchIcon } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePriceFormatter } from "@/state/CurrencyContext";
import {
  searchProducts,
  fetchFacets,
  logSearch,
  spellSuggest,
  type SortKey,
} from "@/lib/search";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  cat: fallback(z.string(), "").default(""),
  brand: fallback(z.string(), "").default(""),
  color: fallback(z.string(), "").default(""),
  size: fallback(z.string(), "").default(""),
  pmin: fallback(z.coerce.number().optional(), undefined),
  pmax: fallback(z.coerce.number().optional(), undefined),
  rating: fallback(z.coerce.number().optional(), undefined),
  stock: fallback(z.coerce.boolean(), false).default(false),
  sort: fallback(
    z.enum([
      "relevance",
      "best_selling",
      "price_asc",
      "price_desc",
      "newest",
      "top_rated",
      "most_viewed",
    ]),
    "relevance",
  ).default("relevance"),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
  head: () =>
    buildMeta({
      title: "بحث — Le Petit Paradis",
      description:
        "ابحث في أحدث تشكيلات أزياء الأطفال الفاخرة من Le Petit Paradis — فساتين، أحذية، وهدايا مختارة بعناية.",
      path: "/search",
      noindex: true,
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

function csv(s?: string) {
  return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

function SearchPage() {
  const sp = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { isRTL, lang } = useLanguage();

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<any>({
    categories: [],
    brands: [],
    colors: [],
    sizes: [],
    priceRange: { min: 0, max: 1000 },
  });
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [openFilters, setOpenFilters] = useState(false);

  const filters = useMemo(
    () => ({
      q: sp.q ?? "",
      categoryIds: csv(sp.cat),
      brands: csv(sp.brand),
      colors: csv(sp.color),
      sizes: csv(sp.size),
      priceMin: sp.pmin,
      priceMax: sp.pmax,
      minRating: sp.rating,
      inStockOnly: !!sp.stock,
      sort: sp.sort,
    }),
    [sp],
  );

  useEffect(() => {
    fetchFacets().then(setFacets);
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function setParam<K extends keyof typeof sp>(key: K, value: any) {
    navigate({
      search: (prev: any) => {
        const next = { ...prev, [key]: value };
        if (value === "" || value === undefined || value === false || value === null) {
          delete (next as any)[key];
        }
        return next;
      },
      replace: true,
    });
  }

  function toggleArrayParam(key: "cat" | "brand" | "color" | "size", val: string) {
    const cur = csv(sp[key]);
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    setParam(key, next.join(","));
  }

  function clearAll() {
    navigate({ search: () => ({ q: sp.q || undefined }) as any, replace: true });
  }

  const activeChips: { label: string; onRemove: () => void }[] = [];
  csv(sp.cat).forEach((id) => {
    const c = facets.categories.find((x: any) => x.id === id);
    if (c)
      activeChips.push({
        label: isRTL ? c.name_ar : c.name_en,
        onRemove: () => toggleArrayParam("cat", id),
      });
  });
  csv(sp.brand).forEach((b) =>
    activeChips.push({ label: b, onRemove: () => toggleArrayParam("brand", b) }),
  );
  csv(sp.color).forEach((c) =>
    activeChips.push({ label: c, onRemove: () => toggleArrayParam("color", c) }),
  );
  csv(sp.size).forEach((s) =>
    activeChips.push({ label: s, onRemove: () => toggleArrayParam("size", s) }),
  );
  if (sp.pmin || sp.pmax)
    activeChips.push({
      label: `${sp.pmin ?? 0} – ${sp.pmax ?? "∞"} ${isRTL ? "ر.س" : "SAR"}`,
      onRemove: () => {
        navigate({
          search: (prev: any) => {
            const n = { ...prev };
            delete (n as any).pmin;
            delete (n as any).pmax;
            return n;
          },
          replace: true,
        });
      },
    });
  if (sp.rating)
    activeChips.push({
      label: `${sp.rating}★+`,
      onRemove: () => setParam("rating", undefined),
    });
  if (sp.stock)
    activeChips.push({
      label: isRTL ? "متوفر فقط" : "In stock",
      onRemove: () => setParam("stock", undefined),
    });

  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const fmtNum = (n: number) => n.toLocaleString(locale);
  const fmtPrice = usePriceFormatter();

  const Sidebar = (
    <aside className="space-y-6 text-sm" dir={isRTL ? "rtl" : "ltr"}>
      <FilterGroup title={isRTL ? "السعر" : "Price"}>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder={isRTL ? "من" : "Min"}
            defaultValue={sp.pmin ?? ""}
            onBlur={(e) =>
              setParam("pmin", e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-1/2 h-10 px-3 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder={isRTL ? "إلى" : "Max"}
            defaultValue={sp.pmax ?? ""}
            onBlur={(e) =>
              setParam("pmax", e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-1/2 h-10 px-3 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>
      </FilterGroup>

      {facets.categories.length > 0 && (
        <FilterGroup title={isRTL ? "القسم" : "Category"}>
          <div className="space-y-2 max-h-44 overflow-y-auto pe-1">
            {facets.categories.map((c: any) => (
              <label
                key={c.id}
                className="flex items-center gap-2 cursor-pointer text-foreground/80 hover:text-foreground transition"
              >
                <input
                  type="checkbox"
                  checked={csv(sp.cat).includes(c.id)}
                  onChange={() => toggleArrayParam("cat", c.id)}
                  className="accent-gold w-4 h-4"
                />
                <span>{isRTL ? c.name_ar : c.name_en}</span>
              </label>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.brands.length > 0 && (
        <FilterGroup title={isRTL ? "العلامة التجارية" : "Brand"}>
          <div className="space-y-2 max-h-44 overflow-y-auto pe-1">
            {facets.brands.map((b: string) => (
              <label
                key={b}
                className="flex items-center gap-2 cursor-pointer text-foreground/80 hover:text-foreground transition"
              >
                <input
                  type="checkbox"
                  checked={csv(sp.brand).includes(b)}
                  onChange={() => toggleArrayParam("brand", b)}
                  className="accent-gold w-4 h-4"
                />
                <span>{b}</span>
              </label>
            ))}
          </div>
        </FilterGroup>
      )}

      {facets.colors.length > 0 && (
        <FilterGroup title={isRTL ? "اللون" : "Color"}>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c: string) => {
              const active = csv(sp.color).includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleArrayParam("color", c)}
                  className={[
                    "px-3.5 h-9 rounded-full border text-xs tracking-soft transition",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-foreground/80 hover:border-gold/60",
                  ].join(" ")}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {facets.sizes.length > 0 && (
        <FilterGroup title={isRTL ? "المقاس" : "Size"}>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s: string) => {
              const active = csv(sp.size).includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleArrayParam("size", s)}
                  className={[
                    "px-3 h-9 min-w-11 rounded-full border text-xs font-medium transition",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-foreground/80 hover:border-gold/60",
                  ].join(" ")}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title={isRTL ? "التقييم" : "Rating"}>
        <div className="flex flex-col gap-1.5">
          {[4, 3, 2, 1].map((r) => {
            const active = sp.rating === r;
            return (
              <button
                key={r}
                onClick={() => setParam("rating", active ? undefined : r)}
                className={[
                  "flex items-center gap-1 text-start py-1.5 px-2 rounded-lg transition",
                  active ? "bg-gold-soft text-gold-deep" : "hover:bg-cream-warm",
                ].join(" ")}
              >
                {Array.from({ length: r }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-gold text-gold"
                    strokeWidth={1.5}
                  />
                ))}
                <span className="text-xs ms-1 text-muted-foreground">
                  {isRTL ? "وأعلى" : "& up"}
                </span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title={isRTL ? "التوفر" : "Availability"}>
        <label className="flex items-center gap-2 cursor-pointer text-foreground/80">
          <input
            type="checkbox"
            checked={!!sp.stock}
            onChange={(e) => setParam("stock", e.target.checked || undefined)}
            className="accent-gold w-4 h-4"
          />
          <span>{isRTL ? "متوفر فقط" : "In stock only"}</span>
        </label>
      </FilterGroup>

      {activeChips.length > 0 && (
        <button
          onClick={clearAll}
          className="w-full h-10 rounded-full border border-border text-xs tracking-luxury text-muted-foreground hover:border-gold/60 hover:text-gold-deep transition"
        >
          {isRTL ? "مسح كل الفلاتر" : "Clear all filters"}
        </button>
      )}
    </aside>
  );

  return (
    <div className="min-h-screen bg-cream" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sticky search header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3.5">
          <SearchBar isRTL={isRTL} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-24 bg-background rounded-2xl border border-border p-5 shadow-soft">
            <h2 className="font-serif text-xl text-foreground mb-5">
              {isRTL ? "تنقية النتائج" : "Refine"}
            </h2>
            {Sidebar}
          </div>
        </div>

        <div>
          {/* Header row */}
          <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
            <div>
              <p className="text-[10.5px] tracking-luxury text-gold-deep mb-1.5">
                {isRTL ? "نتائج البحث" : "SEARCH RESULTS"}
              </p>
              <h1 className="font-serif text-2xl md:text-3xl text-foreground leading-tight">
                {sp.q
                  ? isRTL
                    ? `"${sp.q}"`
                    : `"${sp.q}"`
                  : isRTL
                    ? "كل المنتجات"
                    : "All products"}
              </h1>
              <p
                className="text-xs text-muted-foreground mt-1.5 tracking-soft"
                aria-live="polite"
                aria-atomic="true"
              >
                {loading
                  ? isRTL ? "جارٍ تحميل النتائج…" : "Loading results…"
                  : `${fmtNum(total)} ${isRTL ? "نتيجة" : total === 1 ? "result" : "results"}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenFilters(true)}
                className="lg:hidden inline-flex items-center gap-1.5 px-4 h-10 border border-border bg-background rounded-full text-xs tracking-soft text-foreground/80 active:scale-95 transition"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {isRTL ? "فلترة" : "Filter"}
                {activeChips.length > 0 && (
                  <span className="inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-background text-[10px] font-medium">
                    {activeChips.length}
                  </span>
                )}
              </button>
              <select
                value={sp.sort}
                onChange={(e) => setParam("sort", e.target.value)}
                className="h-10 px-3 rounded-full border border-border bg-background text-xs tracking-soft text-foreground/80 focus:outline-none focus:ring-2 focus:ring-gold/40 cursor-pointer"
                aria-label={isRTL ? "ترتيب النتائج" : "Sort results"}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {isRTL ? o.label_ar : o.label_en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {activeChips.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 ps-3 pe-1.5 h-8 bg-gold-soft text-gold-deep rounded-full text-xs tracking-soft"
                >
                  {c.label}
                  <button
                    onClick={c.onRemove}
                    aria-label={isRTL ? "إزالة الفلتر" : "Remove filter"}
                    className="grid place-items-center h-5 w-5 rounded-full hover:bg-background/60 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground tracking-soft px-2 self-center"
              >
                {isRTL ? "مسح الكل" : "Clear all"}
              </button>
            </div>
          )}

          {/* Results */}
          {loading ? (
            <div
              className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5"
              role="status"
              aria-busy="true"
              aria-label={isRTL ? "جارٍ تحميل النتائج" : "Loading results"}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-cream-warm animate-pulse rounded-2xl"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-3xl border border-border">
              <div className="inline-grid place-items-center w-16 h-16 rounded-full bg-cream-warm mb-4">
                <SearchIcon className="h-7 w-7 text-gold-deep" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-2xl text-foreground mb-2">
                {isRTL ? "لا توجد نتائج" : "No results found"}
              </p>
              <p className="text-sm text-muted-foreground tracking-soft mb-5 max-w-sm mx-auto px-6">
                {isRTL
                  ? "حاول استخدام كلمات أبسط أو إزالة بعض الفلاتر."
                  : "Try simpler keywords or remove some filters."}
              </p>
              {didYouMean && (
                <button
                  onClick={() => setParam("q", didYouMean)}
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-gold text-background text-xs tracking-luxury font-medium active:scale-95 transition shadow-gold"
                >
                  {isRTL ? `هل تقصد: ${didYouMean}؟` : `Did you mean: ${didYouMean}?`}
                </button>
              )}
              {activeChips.length > 0 && !didYouMean && (
                <button
                  onClick={clearAll}
                  className="h-10 px-5 rounded-full border border-border text-xs tracking-luxury text-foreground/80 hover:border-gold/60 transition"
                >
                  {isRTL ? "مسح الفلاتر" : "Clear filters"}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
              {items.map((p) => (
                <Link
                  key={p.id}
                  to="/category/$slug"
                  params={{ slug: p.slug ?? p.id }}
                  className="group block bg-background rounded-2xl overflow-hidden border border-border hover:shadow-soft hover:border-gold/40 transition"
                >
                  <div className="aspect-[3/4] bg-cream-warm overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={isRTL ? p.name_ar : p.name_en}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground">
                        <SearchIcon className="h-8 w-8" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                  <div className="p-3.5">
                    {p.brand && (
                      <div className="text-[10px] tracking-luxury text-gold-deep mb-1">
                        {p.brand}
                      </div>
                    )}
                    <div className="text-sm text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
                      {isRTL ? p.name_ar : p.name_en}
                    </div>
                    <div className="mt-2.5 font-serif text-[17px] text-foreground tabular-nums">
                      {fmtNum(p.price)}
                      <span className="text-[11px] text-muted-foreground ms-1 tracking-soft">
                        {p.currency || (isRTL ? "ر.س" : "SAR")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filters drawer */}
      {openFilters && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpenFilters(false)}
          />
          <div
            className={[
              "absolute top-0 h-full w-[88%] max-w-sm bg-background overflow-y-auto shadow-soft",
              "animate-in duration-300",
              isRTL ? "right-0 slide-in-from-right" : "left-0 slide-in-from-left",
            ].join(" ")}
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-serif text-xl text-foreground">
                {isRTL ? "تنقية النتائج" : "Filters"}
              </h2>
              <button
                onClick={() => setOpenFilters(false)}
                aria-label={isRTL ? "إغلاق" : "Close"}
                className="h-9 w-9 grid place-items-center rounded-full border border-border text-foreground active:scale-90 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 pb-32">{Sidebar}</div>
            <div className="fixed bottom-0 inset-x-0 max-w-sm bg-background border-t border-border p-4 flex gap-2">
              <button
                onClick={clearAll}
                className="flex-1 h-12 rounded-full border border-border text-xs tracking-luxury text-foreground/70 active:scale-95 transition"
              >
                {isRTL ? "مسح" : "Clear"}
              </button>
              <button
                onClick={() => setOpenFilters(false)}
                className="flex-[2] h-12 rounded-full bg-foreground text-background text-xs tracking-luxury font-medium active:scale-95 transition"
              >
                {isRTL
                  ? `عرض ${fmtNum(total)} نتيجة`
                  : `Show ${fmtNum(total)} results`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10.5px] tracking-luxury text-gold-deep mb-3 uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}
