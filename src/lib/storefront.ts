// Helpers for fetching storefront content (banners, categories, popular picks, announcements, settings)
import { supabase } from "@/integrations/supabase/client";

export type Banner = {
  id: string;
  image_url: string;
  title_ar: string | null;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  eyebrow_ar: string | null;
  eyebrow_en: string | null;
  cta_label_ar: string | null;
  cta_label_en: string | null;
  cta_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type FeaturedCategory = {
  id: string;
  label_ar: string;
  label_en: string;
  image_url: string | null;
  link_url: string;
  sort_order: number;
  is_active: boolean;
};

export type PopularPick = {
  id: string;
  label_ar: string;
  label_en: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
};

export type AnnouncementMessage = {
  id: string;
  message_ar: string;
  message_en: string;
  sort_order: number;
  is_active: boolean;
};

export type BannerDisplayMode = "rotate" | "slider";

export type StorefrontSettings = {
  banner_autoplay_seconds: number;
  banner_display_mode: BannerDisplayMode;
  announcement_rotate_seconds: number;
  footer_about_ar: string | null;
  footer_about_en: string | null;
  footer_phone: string | null;
  footer_email: string | null;
  footer_address_ar: string | null;
  footer_address_en: string | null;
  footer_instagram: string | null;
  footer_tiktok: string | null;
  footer_whatsapp: string | null;
};

export async function fetchBanners(activeOnly = true): Promise<Banner[]> {
  let q = supabase.from("storefront_banners").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Banner[];
}

export async function fetchFeaturedCategories(activeOnly = true): Promise<FeaturedCategory[]> {
  // Prefer the new admin-managed table; fall back to the legacy one.
  try {
    let q = (supabase as any)
      .from("shop_by_category_items")
      .select("id, title_ar, title_en, image_url, category_id, href, display_order, is_active");
    if (activeOnly) q = q.eq("is_active", true);
    const { data } = await q.order("display_order", { ascending: true });
    if (Array.isArray(data) && data.length) {
      return data.map((r: any) => ({
        id: r.id,
        title: r.title_ar,
        title_ar: r.title_ar,
        title_en: r.title_en,
        image_url: r.image_url,
        category_id: r.category_id,
        href: r.href || (r.category_id ? `/category/${r.category_id}` : "/"),
        sort_order: r.display_order,
        is_active: r.is_active,
      })) as unknown as FeaturedCategory[];
    }
  } catch (e) {
    console.warn("[storefront] shop_by_category_items unavailable, falling back", e);
  }
  let q = supabase.from("featured_categories").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FeaturedCategory[];
}

export async function fetchPopularPicks(activeOnly = true): Promise<PopularPick[]> {
  // Prefer the new admin-managed season_picks table; fall back to legacy popular_picks.
  try {
    let q = (supabase as any)
      .from("season_picks")
      .select("id, title_ar, title_en, subtitle_ar, subtitle_en, product_id, badge_ar, badge_en, display_order, is_active");
    if (activeOnly) q = q.eq("is_active", true);
    const { data } = await q.order("display_order", { ascending: true });
    if (Array.isArray(data) && data.length) {
      return data.map((r: any) => ({
        id: r.id,
        title: r.title_ar,
        title_ar: r.title_ar,
        title_en: r.title_en,
        subtitle: r.subtitle_ar,
        subtitle_ar: r.subtitle_ar,
        subtitle_en: r.subtitle_en,
        product_id: r.product_id,
        badge: r.badge_ar,
        badge_ar: r.badge_ar,
        badge_en: r.badge_en,
        sort_order: r.display_order,
        is_active: r.is_active,
      })) as unknown as PopularPick[];
    }
  } catch (e) {
    console.warn("[storefront] season_picks unavailable, falling back", e);
  }
  let q = supabase.from("popular_picks").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PopularPick[];
}

export async function fetchAnnouncements(activeOnly = true): Promise<AnnouncementMessage[]> {
  let q = supabase.from("announcement_messages").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AnnouncementMessage[];
}

let _settingsCache: StorefrontSettings | null | undefined;
let _settingsPromise: Promise<StorefrontSettings | null> | null = null;

export async function fetchStorefrontSettings(force = false): Promise<StorefrontSettings | null> {
  if (!force && _settingsCache !== undefined) return _settingsCache;
  if (!force && _settingsPromise) return _settingsPromise;
  _settingsPromise = (async () => {
    const { data, error } = await supabase.from("storefront_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    const value = (data as StorefrontSettings | null) ?? null;
    _settingsCache = value;
    return value;
  })();
  try {
    return await _settingsPromise;
  } finally {
    _settingsPromise = null;
  }
}

export function clearStorefrontSettingsCache() {
  _settingsCache = undefined;
}

/** Upload an image to the `storefront` bucket and return its public URL. */
export async function uploadStorefrontImage(file: File, prefix = "img"): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("storefront").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("storefront").getPublicUrl(path);
  return data.publicUrl;
}

/* ============================================================
   Home Sections (Page Builder for the storefront landing page)
   ============================================================ */

export type HomeSectionKind =
  | "hero"
  | "banners"
  | "featured_categories"
  | "most_popular"
  | "new_arrivals"
  | "custom_collection"
  | "announcements"
  | "rich_text";

export type HomeSectionDataSource =
  | "auto"
  | "best_sellers"
  | "newest"
  | "category"
  | "collection"
  | "manual";

export type HomeSection = {
  id: string;
  kind: HomeSectionKind;
  title_ar: string | null;
  title_en: string | null;
  eyebrow_ar: string | null;
  eyebrow_en: string | null;
  data_source: HomeSectionDataSource;
  source_ref: string | null;
  product_ids: string[];
  config: Record<string, unknown>;
  position: number;
  is_active: boolean;
};

export type ResolvedProduct = {
  id: string;
  slug: string | null;
  name_ar: string | null;
  name_en: string | null;
  price: number | null;
  image_url: string | null;
};

export async function fetchHomeSections(activeOnly = true): Promise<HomeSection[]> {
  let q = supabase.from("home_sections").select("*").order("position");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HomeSection[];
}

/**
 * Resolves the products to render for a section based on its data_source.
 * - manual: order matches `section.product_ids`
 * - best_sellers: order by sales_count desc
 * - newest: order by created_at desc
 * - category: products in `categories.slug` = source_ref via category_products
 * - collection: products from landing_pages.product_ids where id = source_ref
 * - auto: same as best_sellers (sensible default)
 */
export async function resolveSectionProducts(section: HomeSection, limit = 8): Promise<ResolvedProduct[]> {
  const cols = "id, slug, name_ar, name_en, price, image_url";

  if (section.data_source === "manual" && section.product_ids.length > 0) {
    const { data } = await supabase
      .from("products")
      .select(cols)
      .in("id", section.product_ids)
      .eq("is_active", true);
    const map = new Map((data ?? []).map((p: any) => [p.id, p as ResolvedProduct]));
    return section.product_ids.map((id) => map.get(id)).filter(Boolean).slice(0, limit) as ResolvedProduct[];
  }

  if (section.data_source === "collection" && section.source_ref) {
    const { data: page } = await supabase
      .from("landing_pages")
      .select("product_ids, sort_mode")
      .eq("id", section.source_ref)
      .maybeSingle();
    const ids = (page?.product_ids ?? []) as string[];
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("products")
      .select(cols)
      .in("id", ids)
      .eq("is_active", true);
    const map = new Map((data ?? []).map((p: any) => [p.id, p as ResolvedProduct]));
    return ids.map((id) => map.get(id)).filter(Boolean).slice(0, limit) as ResolvedProduct[];
  }

  if (section.data_source === "category" && section.source_ref) {
    // Look up category_id by slug, then category_products → products
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", section.source_ref)
      .maybeSingle();
    if (!cat) return [];
    const { data: rows } = await supabase
      .from("category_products")
      .select("product_id")
      .eq("category_id", (cat as any).id)
      .limit(limit * 2);
    const ids = ((rows ?? []) as any[]).map((r) => r.product_id).filter(Boolean);
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("products")
      .select(cols)
      .in("id", ids)
      .eq("is_active", true)
      .limit(limit);
    return (data ?? []) as ResolvedProduct[];
  }

  if (section.data_source === "newest") {
    const { data } = await supabase
      .from("products")
      .select(cols)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as ResolvedProduct[];
  }

  // best_sellers / auto
  const { data } = await supabase
    .from("products")
    .select(cols)
    .eq("is_active", true)
    .order("sales_count", { ascending: false })
    .limit(limit);
  return (data ?? []) as ResolvedProduct[];
}

