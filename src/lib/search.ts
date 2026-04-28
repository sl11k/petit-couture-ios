import { supabase } from "@/integrations/supabase/client";

export type SortKey =
  | "relevance"
  | "best_selling"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "top_rated"
  | "most_viewed";

export interface SearchFilters {
  q?: string;
  categoryIds?: string[];
  brands?: string[];
  colors?: string[];
  sizes?: string[];
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  inStockOnly?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface SuggestionItem {
  kind: "product" | "category";
  id: string;
  label_ar: string;
  label_en: string;
  slug: string;
  image_url: string | null;
  price: number | null;
  similarity: number;
}

// ===== Autocomplete (typo-tolerant + categories) =====
export async function autocomplete(query: string, limit = 8): Promise<SuggestionItem[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const { data, error } = await (supabase as any).rpc("search_autocomplete", { _q: q, _limit: limit });
  if (error) {
    console.warn("autocomplete error", error);
    return [];
  }
  return (data ?? []) as SuggestionItem[];
}

// ===== Spell suggestion ("did you mean ...?") =====
export async function spellSuggest(query: string): Promise<string | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const { data } = await (supabase as any).rpc("search_spell_suggest", { _q: q });
  return (data as string | null) ?? null;
}

// ===== Synonym expansion =====
async function expandSynonyms(q: string): Promise<string[]> {
  const lower = q.trim().toLowerCase();
  if (!lower) return [];
  const { data } = await supabase
    .from("search_synonyms")
    .select("term, synonym")
    .or(`term.ilike.${lower},synonym.ilike.${lower}`);
  const terms = new Set<string>([lower]);
  (data ?? []).forEach((r: any) => {
    terms.add(String(r.term).toLowerCase());
    terms.add(String(r.synonym).toLowerCase());
  });
  return Array.from(terms);
}

// ===== Log search (anonymous-safe) =====
export async function logSearch(query: string, resultsCount: number, sessionId?: string) {
  if (!query.trim()) return;
  try {
    await supabase.from("search_logs").insert({
      query: query.trim().toLowerCase(),
      results_count: resultsCount,
      session_id: sessionId ?? null,
    });
  } catch (e) {
    /* non-fatal */
  }
}

export async function recordSearchClick(query: string, productId: string, sessionId?: string) {
  try {
    await supabase.from("search_logs").insert({
      query: query.trim().toLowerCase(),
      results_count: 1,
      clicked_product_id: productId,
      session_id: sessionId ?? null,
    });
  } catch {
    /* non-fatal */
  }
}

// ===== Full search with filters & sorting =====
export async function searchProducts(filters: SearchFilters) {
  const {
    q, categoryIds, brands, colors, sizes,
    priceMin, priceMax, minRating, inStockOnly,
    sort = "relevance", page = 1, pageSize = 24,
  } = filters;

  let query = supabase.from("products").select("*", { count: "exact" }).eq("is_active", true);

  // Text search with synonym expansion
  if (q && q.trim()) {
    const terms = await expandSynonyms(q);
    const ors = terms.flatMap((t) => [
      `name_ar.ilike.%${t}%`,
      `name_en.ilike.%${t}%`,
      `brand.ilike.%${t}%`,
      `sku.ilike.%${t}%`,
    ]).join(",");
    query = query.or(ors);
  }

  if (categoryIds && categoryIds.length) query = query.in("category_id", categoryIds);
  if (brands && brands.length) query = query.in("brand", brands);
  if (typeof priceMin === "number") query = query.gte("price", priceMin);
  if (typeof priceMax === "number") query = query.lte("price", priceMax);
  if (inStockOnly) query = query.gt("stock", 0);

  // Sorting
  switch (sort) {
    case "price_asc": query = query.order("price", { ascending: true }); break;
    case "price_desc": query = query.order("price", { ascending: false }); break;
    case "newest": query = query.order("created_at", { ascending: false }); break;
    case "best_selling": query = query.order("sales_count", { ascending: false }); break;
    case "most_viewed": query = query.order("views_count", { ascending: false }); break;
    case "top_rated":
    case "relevance":
    default: query = query.order("sales_count", { ascending: false }); break;
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.warn("searchProducts error", error);
    return { items: [], total: 0 };
  }

  let items = (data ?? []) as any[];

  // Client-side filter for colors/sizes (jsonb arrays)
  if (colors && colors.length) {
    items = items.filter((p) => {
      const arr = Array.isArray(p.colors) ? p.colors : [];
      return arr.some((c: any) => colors.includes(String(c).toLowerCase()));
    });
  }
  if (sizes && sizes.length) {
    items = items.filter((p) => {
      const arr = Array.isArray(p.sizes) ? p.sizes : [];
      return arr.some((s: any) => sizes.includes(String(s).toUpperCase()));
    });
  }

  // Rating filter (requires aggregating from reviews)
  if (typeof minRating === "number" && minRating > 0 && items.length) {
    const ids = items.map((p) => p.id);
    const { data: revs } = await supabase
      .from("reviews").select("product_id, rating")
      .in("product_id", ids).eq("status", "approved");
    const byProd = new Map<string, number[]>();
    (revs ?? []).forEach((r: any) => {
      const arr = byProd.get(r.product_id) ?? [];
      arr.push(r.rating); byProd.set(r.product_id, arr);
    });
    items = items.filter((p) => {
      const ratings = byProd.get(p.id) ?? [];
      if (!ratings.length) return false;
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return avg >= minRating;
    });

    // Sort by rating if requested
    if (sort === "top_rated") {
      items.sort((a, b) => {
        const ar = byProd.get(a.id) ?? [];
        const br = byProd.get(b.id) ?? [];
        const avgA = ar.length ? ar.reduce((x, y) => x + y, 0) / ar.length : 0;
        const avgB = br.length ? br.reduce((x, y) => x + y, 0) / br.length : 0;
        return avgB - avgA;
      });
    }
  }

  return { items, total: count ?? items.length };
}

// ===== Facets (build filter sidebar dynamically) =====
export async function fetchFacets() {
  const [{ data: cats }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name_ar, name_en, slug").eq("is_active", true).order("display_order"),
    supabase.from("products").select("brand, colors, sizes, price").eq("is_active", true),
  ]);

  const brands = new Set<string>();
  const colors = new Set<string>();
  const sizes = new Set<string>();
  let minPrice = Infinity, maxPrice = 0;

  (products ?? []).forEach((p: any) => {
    if (p.brand) brands.add(p.brand);
    (Array.isArray(p.colors) ? p.colors : []).forEach((c: any) => c && colors.add(String(c).toLowerCase()));
    (Array.isArray(p.sizes) ? p.sizes : []).forEach((s: any) => s && sizes.add(String(s).toUpperCase()));
    if (typeof p.price === "number") {
      if (p.price < minPrice) minPrice = p.price;
      if (p.price > maxPrice) maxPrice = p.price;
    }
  });

  return {
    categories: cats ?? [],
    brands: Array.from(brands).sort(),
    colors: Array.from(colors).sort(),
    sizes: Array.from(sizes).sort(),
    priceRange: { min: isFinite(minPrice) ? minPrice : 0, max: maxPrice },
  };
}

// ===== Admin search reports =====
export async function fetchSearchReport(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await supabase
    .from("search_logs").select("query, results_count, clicked_product_id, created_at")
    .gte("created_at", since).limit(5000);
  const rows = data ?? [];

  const byQuery = new Map<string, { count: number; zero: number; clicks: number }>();
  rows.forEach((r: any) => {
    const k = r.query;
    const e = byQuery.get(k) ?? { count: 0, zero: 0, clicks: 0 };
    e.count++;
    if (r.results_count === 0) e.zero++;
    if (r.clicked_product_id) e.clicks++;
    byQuery.set(k, e);
  });

  const all = Array.from(byQuery.entries()).map(([query, s]) => ({ query, ...s, ctr: s.count ? s.clicks / s.count : 0 }));
  return {
    top: [...all].sort((a, b) => b.count - a.count).slice(0, 50),
    zero: all.filter((r) => r.zero > 0).sort((a, b) => b.zero - a.zero).slice(0, 50),
    total: rows.length,
  };
}
