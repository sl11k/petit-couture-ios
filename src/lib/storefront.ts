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
  let q = supabase.from("featured_categories").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FeaturedCategory[];
}

export async function fetchPopularPicks(activeOnly = true): Promise<PopularPick[]> {
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
