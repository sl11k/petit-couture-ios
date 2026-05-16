import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, ChevronLeft, SlidersHorizontal, ArrowUpDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LazyImage } from "@/components/LazyImage";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { categories as seedCategories, productsByCategory } from "@/data/categories";
import { usePriceFormatter, useCurrency } from "@/state/CurrencyContext";
import { buildMeta, breadcrumbJsonLd, collectionJsonLd, canonical } from "@/lib/seo";

type DbCategory = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  description_ar: string | null;
  description_en: string | null;
  banner_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
};

type DbProduct = {
  id: string;
  slug: string | null;
  name_ar: string | null;
  name_en: string | null;
  price: number | null;
  compare_at_price: number | null;
  image_url: string | null;
  stock: number | null;
  sales_count: number | null;
  created_at: string;
};

async function loadCategory(slug: string): Promise<{
  category: DbCategory | null;
  seed: { name_ar: string; name_en: string; image: string } | null;
  products: DbProduct[];
}> {
  const { data: category } = await supabase
    .from("categories")
    .select(
      "id, slug, name_ar, name_en, image_url, description_ar, description_en, banner_url, meta_title, meta_description, og_image",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  let products: DbProduct[] = [];
  if (category?.id) {
    // Try category_products link table first
    const { data: links } = await supabase
      .from("category_products")
      .select("product_id, display_order")
      .eq("category_id", category.id)
      .order("display_order", { ascending: true });

    const ids = (links ?? []).map((l: any) => l.product_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("products")
        .select(
          "id, slug, name_ar, name_en, price, compare_at_price, image_url, stock, sales_count, created_at",
        )
        .in("id", ids)
        .eq("is_active", true);
      const byId = new Map((data ?? []).map((p: any) => [p.id, p]));
      products = ids.map((id: string) => byId.get(id)).filter(Boolean) as DbProduct[];
    } else {
      // Fallback: products with category_id pointing to this category
      const { data } = await supabase
        .from("products")
        .select(
          "id, slug, name_ar, name_en, price, compare_at_price, image_url, stock, sales_count, created_at",
        )
        .eq("category_id", category.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      products = (data ?? []) as DbProduct[];
    }
  }

  // Seed fallback for legacy slugs (so cards still render before admin adds products)
  const seedCat = seedCategories.find((c) => c.slug === slug);
  const seed = seedCat
    ? { name_ar: seedCat.name, name_en: seedCat.name, image: seedCat.img }
    : null;

  if (!category && !seed) return { category: null, seed: null, products: [] };
  return { category, seed, products };
}

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const data = await loadCategory(params.slug);
    if (!data.category && !data.seed) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const path = `/category/${params.slug}`;
    const cat = loaderData?.category;
    const seed = loaderData?.seed;
    const nameAr = cat?.name_ar ?? seed?.name_ar ?? "تصنيف";
    const nameEn = cat?.name_en ?? seed?.name_en ?? "Category";
    const image = cat?.og_image ?? cat?.banner_url ?? cat?.image_url ?? seed?.image ?? undefined;
    const desc =
      cat?.meta_description ??
      cat?.description_ar ??
      `تصفّحي تشكيلة ${nameAr} الفاخرة من Le Petit Paradis.`;

    return buildMeta({
      title: cat?.meta_title ?? `${nameAr} — Le Petit Paradis`,
      description: desc,
      path,
      image: typeof image === "string" ? image : undefined,
      type: "website",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "الرئيسية", path: "/" },
          { name: nameAr, path },
        ]),
        collectionJsonLd({
          name: nameAr,
          description: desc,
          url: canonical(path),
          image: typeof image === "string" ? image : "",
          inLanguage: "ar-SA",
          items: (loaderData?.products ?? []).map((p) => ({
            name: p.name_ar ?? p.name_en ?? "",
            url: p.slug ? `/product/${p.slug}` : `/category/${params.slug}`,
            image: p.image_url ?? "",
            price: p.price ?? 0,
            currency: "SAR",
            brand: "Le Petit Paradis",
            sku: p.id,
            availability: (p.stock ?? 0) > 0 ? ("in_stock" as const) : ("out_of_stock" as const),
          })),
        }),
      ],
    });
  },
  notFoundComponent: () => (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-medium">التصنيف غير متوفر</h1>
        <Link to="/" className="inline-block mt-4 underline text-primary">
          الرئيسية
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <p>{(error as Error).message}</p>
    </div>
  ),
  component: CategoryView,
});

function CategoryView() {
  const { category, seed, products } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const wishlist = useWishlist();

  const name = ar
    ? (category?.name_ar ?? seed?.name_ar ?? "تصنيف")
    : (category?.name_en ?? seed?.name_en ?? "Category");
  const description = ar
    ? (category?.description_ar ?? "")
    : (category?.description_en ?? "");
  const banner = category?.banner_url ?? category?.image_url ?? seed?.image ?? null;

  // Seed fallback: when DB has no products yet, render a single "preview card" using seed data
  const [showSeedFallback, setShowSeedFallback] = useState(false);
  useEffect(() => {
    setShowSeedFallback(products.length === 0 && !!productsByCategory["best-sellers"]);
  }, [products.length]);

  // Sort + Filter state
  const [sortKey, setSortKey] = useState<SortKey>("popular");
  const priceBounds = useMemo<[number, number]>(() => {
    const prices = (products as DbProduct[]).map((p) => p.price ?? 0).filter((n: number) => n > 0);
    if (prices.length === 0) return [0, 1000];
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [products]);
  const [priceMax, setPriceMax] = useState<number>(priceBounds[1]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  useEffect(() => { setPriceMax(priceBounds[1]); }, [priceBounds[1]]);

  const filteredProducts = useMemo(() => {
    return (products as DbProduct[]).filter((p) => {
      if ((p.price ?? 0) > priceMax) return false;
      if (inStockOnly && (p.stock ?? 0) <= 0) return false;
      if (onSaleOnly && !(p.compare_at_price && p.price && p.compare_at_price > p.price)) return false;
      return true;
    });
  }, [products, priceMax, inStockOnly, onSaleOnly]);

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    switch (sortKey) {
      case "newest":
        return arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      case "price_asc":
        return arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case "price_desc":
        return arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case "popular":
      default:
        return arr.sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0));
    }
  }, [filteredProducts, sortKey]);

  return (
    <main className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1200px] mx-auto h-14 px-4 flex items-center gap-3">
          <Link
            to="/"
            aria-label={ar ? "رجوع" : "Back"}
            className="h-10 w-10 grid place-items-center rounded-full hover:bg-muted transition"
          >
            <ChevronLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
          <h1 className="text-base sm:text-lg font-medium text-foreground truncate flex-1">
            {name}
          </h1>
          <Link
            to="/wishlist"
            aria-label={ar ? "المفضلة" : "Wishlist"}
            className="h-10 w-10 grid place-items-center rounded-full hover:bg-muted transition"
          >
            <Heart className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        </div>
      </header>

      {/* Banner */}
      {banner && (
        <section className="relative">
          <LazyImage
            src={banner}
            alt={name}
            eager
            width={1600}
            height={600}
            aspect="16/6"
            className="w-full aspect-[16/9] sm:aspect-[16/6] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent flex flex-col justify-end p-6 sm:p-10 text-white">
            <h2 className="font-serif text-2xl sm:text-4xl">{name}</h2>
            {description && (
              <p className="mt-2 text-sm sm:text-base max-w-xl opacity-90">{description}</p>
            )}
          </div>
        </section>
      )}

      {/* Filter / Sort bar */}
      <FilterSortBar
        ar={ar}
        count={sortedProducts.length}
        sort={sortKey}
        onSortChange={setSortKey}
        priceMax={priceMax}
        priceBounds={priceBounds}
        onPriceMaxChange={setPriceMax}
        inStockOnly={inStockOnly}
        onInStockChange={setInStockOnly}
        onSaleOnly={onSaleOnly}
        onOnSaleChange={setOnSaleOnly}
      />

      {/* Products grid */}
      <section className="px-4 sm:px-6 py-6 sm:py-10 max-w-[1200px] mx-auto">
        {sortedProducts.length === 0 ? (
          <EmptyState ar={ar} slug={slug} showFallback={showSeedFallback} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {sortedProducts.map((p: any) => (
              <ProductCard key={p.id} p={p} ar={ar} wishlist={wishlist} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

type SortKey = "popular" | "newest" | "price_asc" | "price_desc";

function FilterSortBar({
  ar,
  count,
  sort,
  onSortChange,
  priceMax,
  priceBounds,
  onPriceMaxChange,
  inStockOnly,
  onInStockChange,
  onSaleOnly,
  onOnSaleChange,
}: {
  ar: boolean;
  count: number;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  priceMax: number;
  priceBounds: [number, number];
  onPriceMaxChange: (n: number) => void;
  inStockOnly: boolean;
  onInStockChange: (b: boolean) => void;
  onSaleOnly: boolean;
  onOnSaleChange: (b: boolean) => void;
}) {
  const [openSort, setOpenSort] = useState(false);
  const [openFilter, setOpenFilter] = useState(false);
  const sortLabels: Record<SortKey, string> = ar
    ? {
        popular: "الأكثر شهرة",
        newest: "الأحدث",
        price_asc: "السعر: من الأقل",
        price_desc: "السعر: من الأعلى",
      }
    : {
        popular: "Most Popular",
        newest: "Newest",
        price_asc: "Price: Low to High",
        price_desc: "Price: High to Low",
      };

  return (
    <div className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 divide-x divide-border">
        <button
          type="button"
          onClick={() => setOpenFilter(true)}
          className="h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-foreground hover:bg-muted/50 transition"
        >
          <span>{ar ? "تصفية" : "Filter By"}</span>
          <SlidersHorizontal className="h-4 w-4 text-primary" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenSort((v) => !v)}
            className="w-full h-12 flex items-center justify-center gap-2 text-[14px] font-medium text-foreground hover:bg-muted/50 transition"
          >
            <span>{sortLabels[sort]}</span>
            <ArrowUpDown className="h-4 w-4 text-primary" />
          </button>
          {openSort && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpenSort(false)} aria-hidden />
              <ul className="absolute z-40 end-2 mt-1 w-56 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
                {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        onSortChange(k);
                        setOpenSort(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-[13.5px] hover:bg-muted text-start"
                    >
                      <span>{sortLabels[k]}</span>
                      {sort === k && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {count > 0 && (
        <p className="text-center text-[12.5px] text-muted-foreground py-1.5">
          {ar ? `عرض ${count} منتج` : `Showing ${count} styles`}
        </p>
      )}

      {openFilter && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpenFilter(false)} aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl border-t border-border p-5 max-w-[600px] mx-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{ar ? "تصفية" : "Filter"}</h3>
              <button onClick={() => setOpenFilter(false)} className="text-sm text-primary">
                {ar ? "تم" : "Done"}
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-[13px] mb-2">
                  <span>{ar ? "أقصى سعر" : "Max price"}</span>
                  <span className="text-primary font-medium">{priceMax} {ar ? "ر.س" : "SAR"}</span>
                </div>
                <input
                  type="range"
                  min={priceBounds[0]}
                  max={priceBounds[1]}
                  value={priceMax}
                  onChange={(e) => onPriceMaxChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                  <span>{priceBounds[0]}</span>
                  <span>{priceBounds[1]}</span>
                </div>
              </div>

              <label className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-[14px]">{ar ? "متوفر فقط" : "In stock only"}</span>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => onInStockChange(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <label className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-[14px]">{ar ? "العروض فقط" : "On sale only"}</span>
                <input
                  type="checkbox"
                  checked={onSaleOnly}
                  onChange={(e) => onOnSaleChange(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  onPriceMaxChange(priceBounds[1]);
                  onInStockChange(false);
                  onOnSaleChange(false);
                }}
                className="w-full h-11 rounded-lg border border-border text-[13px] text-foreground hover:bg-muted transition"
              >
                {ar ? "إعادة ضبط" : "Reset filters"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({
  ar,
  slug,
  showFallback,
}: {
  ar: boolean;
  slug: string;
  showFallback: boolean;
}) {
  const fmt = usePriceFormatter();
  ar,
  slug,
  showFallback,
}: {
  ar: boolean;
  slug: string;
  showFallback: boolean;
}) {
  if (!showFallback) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          {ar ? "لا توجد منتجات في هذا التصنيف بعد." : "No products in this category yet."}
        </p>
      </div>
    );
  }
  // Seed preview card (so the page is never empty before admin adds products)
  const seedProduct = productsByCategory["best-sellers"];
  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        {ar ? "عيّنة معروضة. يضيف المسؤول منتجات حقيقية من لوحة الإدارة." : "Preview shown. Admin adds real products from the dashboard."}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        <Link to="/product/$slug" params={{ slug }} className="group block">
          <LazyImage
            src={seedProduct.images[0]}
            alt={seedProduct.name}
            width={500}
            height={625}
            aspect="4/5"
            className="w-full aspect-[4/5] object-cover rounded-md group-hover:opacity-90 transition"
          />
          <div className="mt-2.5">
            <p className="text-sm text-foreground line-clamp-1">{seedProduct.name}</p>
            <p className="text-[13px] text-gold-deep mt-0.5">
              {seedProduct.price.toFixed(2)} {ar ? "ر.س" : "SAR"}
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}

function ProductCard({
  p,
  ar,
  wishlist,
}: {
  p: DbProduct;
  ar: boolean;
  wishlist: ReturnType<typeof useWishlist>;
}) {
  const name = ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar);
  const wishId = `product:${p.slug ?? p.id}`;
  const wished = wishlist.has(wishId);
  return (
    <div className="group relative">
      <Link
        to="/product/$slug"
        params={{ slug: p.slug ?? p.id }}
        className="block"
      >
        {p.image_url ? (
          <LazyImage
            src={p.image_url}
            alt={name ?? ""}
            width={500}
            height={625}
            aspect="4/5"
            className="w-full aspect-[4/5] object-cover rounded-md group-hover:opacity-90 transition"
          />
        ) : (
          <div className="aspect-[4/5] bg-muted rounded-md" />
        )}
        <div className="mt-2.5">
          <p className="text-sm text-foreground line-clamp-1">{name}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            {p.price != null && (
              <p className="text-[13px] text-gold-deep">
                {p.price.toFixed(2)} {ar ? "ر.س" : "SAR"}
              </p>
            )}
            {p.compare_at_price != null && p.price != null && p.compare_at_price > p.price && (
              <p className="text-[12px] text-muted-foreground line-through">
                {p.compare_at_price.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={ar ? "أضف للمفضلة" : "Add to wishlist"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          wishlist.toggle(wishId, "category_card");
        }}
        className="absolute top-2 end-2 h-9 w-9 grid place-items-center rounded-full bg-background/85 backdrop-blur border border-border hover:bg-background transition"
      >
        <Heart
          className="h-4 w-4 text-foreground"
          strokeWidth={1.5}
          fill={wished ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}
