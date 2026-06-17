import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getProductForCategory,
  type Product as StaticProduct,
} from "@/data/categories";
import { useLanguage } from "@/i18n/LanguageContext";
import { sortByAge } from "@/lib/ageSort";

/**
 * Hooks that fetch real products from the `products` table by slug and merge
 * them onto the static fallback shape (`Product` from `@/data/categories`).
 * If a slug is not present in the DB, the static fallback is returned so
 * existing UI keeps working unchanged.
 */

type DbRow = {
  id: string;
  slug: string;
  name_ar: string | null;
  name_en: string | null;
  brand: string | null;
  description_ar: string | null;
  description_en: string | null;
  short_description_ar: string | null;
  short_description_en: string | null;
  price: number | null;
  compare_at_price: number | null;
  currency: string | null;
  image_url: string | null;
  images: unknown;
  sizes: unknown;
  colors: unknown;
  stock: number | null;
  low_stock_threshold: number | null;
  status: string | null;
  video_url: string | null;
  sku: string | null;
  is_active: boolean | null;
};

type MergedProduct = StaticProduct & {
  videoUrl?: string;
  __fromDb?: boolean;
};

function arr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  return [];
}

function mergeRowOntoBase(slug: string, row: DbRow | null, lang: "ar" | "en"): MergedProduct {
  const base = getProductForCategory(slug) as MergedProduct;
  if (!row) return base;

  const name =
    (lang === "ar" ? row.name_ar : row.name_en) ||
    row.name_en ||
    row.name_ar ||
    base.name;
  const shortDescription =
    (lang === "ar" ? row.short_description_ar : row.short_description_en) ||
    row.short_description_en ||
    row.short_description_ar ||
    base.shortDescription;
  const description =
    (lang === "ar" ? row.description_ar : row.description_en) ||
    row.description_en ||
    row.description_ar ||
    base.description;

  const imgs = arr<string>(row.images).filter(Boolean);
  const images = imgs.length
    ? imgs
    : row.image_url
      ? [row.image_url]
      : base.images;

  const sizes = sortByAge(arr<string>(row.sizes).filter(Boolean), (s: string) => s);
  const colorsRaw = arr<{ name?: string; hex?: string; image?: string } | string>(row.colors);
  const colors = colorsRaw
    .map((c) => {
      if (typeof c === "string") return { name: c, hex: "#cccccc" };
      if (c && typeof c === "object" && c.name) {
        return { name: c.name, hex: c.hex ?? "#cccccc", image: c.image };
      }
      return null;
    })
    .filter((c): c is { name: string; hex: string; image?: string } => !!c);

  const stock = row.stock ?? base.stock;
  const lowStockThreshold = row.low_stock_threshold ?? base.lowStockThreshold;
  let status: StaticProduct["status"] = base.status;
  if (row.status === "out_of_stock" || stock <= 0) status = "out_of_stock";
  else if (row.status === "preorder") status = "preorder";
  else if (row.status === "coming_soon") status = "coming_soon";
  else if (stock <= lowStockThreshold) status = "low_stock";
  else status = "in_stock";

  return {
    ...base,
    slug,
    name,
    brand: row.brand ?? base.brand,
    sku: row.sku ?? base.sku,
    price: row.price != null ? Number(row.price) : base.price,
    compareAtPrice:
      row.compare_at_price != null ? Number(row.compare_at_price) : base.compareAtPrice,
    currency: row.currency ?? base.currency,
    shortDescription,
    description,
    images,
    sizes: sizes.length ? sizes : base.sizes,
    colors: colors.length ? colors : base.colors,
    stock,
    lowStockThreshold,
    status,
    videoUrl: row.video_url ?? base.videoUrl,
    __fromDb: true,
  };
}

const SELECT_COLS =
  "id,slug,name_ar,name_en,brand,description_ar,description_en,short_description_ar,short_description_en,price,compare_at_price,currency,image_url,images,sizes,colors,stock,low_stock_threshold,status,video_url,sku,is_active";

export type SizeVariant = {
  size: string;
  sku: string | null;
  price: number | null;
  stock: number;
};

/**
 * Per-size variants for a product (rows in `product_variants` tagged
 * attributes.kind = "size"). Each size carries its own SKU, price and stock,
 * entered via the admin "Sizes & SKUs" editor. Returns an empty list for
 * products that don't use per-size SKUs, so callers stay backward-compatible.
 */
export function useProductSizeVariants(productId: string | null): {
  variants: SizeVariant[];
  bySize: Record<string, SizeVariant>;
  loading: boolean;
} {
  const [variants, setVariants] = useState<SizeVariant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) {
      setVariants([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (supabase as any)
      .from("product_variants")
      .select("size, sku, price, stock, is_active, attributes, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .then(({ data }: { data: unknown }) => {
        if (cancelled) return;
        const rows: SizeVariant[] = (arr<any>(data))
          .filter((r) => r?.attributes?.kind === "size" && r?.is_active !== false && String(r?.size ?? "").trim() !== "")
          .map((r) => ({
            size: String(r.size).trim(),
            sku: r.sku ?? null,
            price: r.price != null ? Number(r.price) : null,
            stock: Number(r.stock) || 0,
          }));
        setVariants(rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const bySize = useMemo(() => {
    const m: Record<string, SizeVariant> = {};
    for (const v of variants) m[v.size] = v;
    return m;
  }, [variants]);

  return { variants, bySize, loading };
}

export function useDbProductBySlug(slug: string): {
  product: MergedProduct;
  productId: string | null;
  loading: boolean;
  fromDb: boolean;
} {
  const { lang } = useLanguage();
  const [row, setRow] = useState<DbRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("products")
      .select(SELECT_COLS)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRow((data as DbRow | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const product = mergeRowOntoBase(slug, row, lang === "ar" ? "ar" : "en");
  return { product, productId: row?.id ?? null, loading, fromDb: !!row };
}

export function useDbProductsBySlugs(slugs: string[]): {
  bySlug: Record<string, MergedProduct>;
  loading: boolean;
} {
  const { lang } = useLanguage();
  const key = slugs.slice().sort().join("|");
  const [rows, setRows] = useState<Record<string, DbRow>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugs.length) {
      setRows({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("products")
      .select(SELECT_COLS)
      .in("slug", slugs)
      .eq("is_active", true)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, DbRow> = {};
        for (const r of (data ?? []) as DbRow[]) {
          if (r.slug) map[r.slug] = r;
        }
        setRows(map);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const bySlug: Record<string, MergedProduct> = {};
  for (const slug of slugs) {
    bySlug[slug] = mergeRowOntoBase(slug, rows[slug] ?? null, lang === "ar" ? "ar" : "en");
  }
  return { bySlug, loading };
}

/**
 * Fetch up to `limit` other active products in the same category as the
 * product identified by `slug`. Used for "Related products" on the PDP.
 */
export function useDbRelatedProducts(
  slug: string,
  limit = 8,
): { products: MergedProduct[]; loading: boolean } {
  const { lang } = useLanguage();
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: current } = await supabase
        .from("products")
        .select("id, category_id")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      const categoryId = (current as { category_id?: string } | null)?.category_id;
      const currentId = (current as { id?: string } | null)?.id;
      if (!categoryId) {
        setRows([]);
        setLoading(false);
        return;
      }
      let q = supabase
        .from("products")
        .select(SELECT_COLS)
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .limit(limit + 1);
      if (currentId) q = q.neq("id", currentId);
      const { data } = await q;
      if (cancelled) return;
      setRows(((data ?? []) as DbRow[]).slice(0, limit));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, limit]);

  const products = rows
    .map((r) => mergeRowOntoBase(r.slug, r, lang === "ar" ? "ar" : "en"))
    .filter((p) => p.slug !== slug);
  return { products, loading };
}

