import { supabase } from "@/integrations/supabase/client";

export type HeaderNavItem = {
  slug: string;
  label_ar: string;
  label_en: string;
  href: string;
};

const normalizeHref = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const href = raw.startsWith("/") ? raw : `/${raw}`;
  // Support CMS-created "route:" slugs (e.g. "route:%2Four-story"). If an
  // admin accidentally stored a route:... slug as a header href, decode it to
  // the actual route so navigation goes to the intended path instead of
  // /page/route:%25.. which looks broken to users.
  try {
    // Check for /page/route: prefix
    const pageMarker = "/page/route:";
    if (href.toLowerCase().startsWith(pageMarker)) {
      const encoded = href.slice(pageMarker.length);
      const decoded = decodeURIComponent(encoded);
      if (decoded) return decoded;
    }
    // Also check for route: prefix directly (without /page/)
    const routeMarker = "route:";
    if (href.toLowerCase().startsWith(routeMarker)) {
      const encoded = href.slice(routeMarker.length);
      const decoded = decodeURIComponent(encoded);
      if (decoded) return decoded;
    }
  } catch {
    /* ignore decode errors */
  }
  return href;
};

const buildSlug = (href: string) =>
  href
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\//g, "-") || "home";

export async function fetchHeaderNavItems(client: any = supabase): Promise<HeaderNavItem[]> {
  const { data } = await client
    .from("header_nav_items")
    .select("label_ar, label_en, href, is_active, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return (Array.isArray(data) ? data : [])
    .map((row: any) => {
      const href = normalizeHref(row.href);
      const label_ar = String(row.label_ar ?? "").trim();
      const label_en = String(row.label_en ?? "").trim();
      if (!href) return null;
      if (!label_ar && !label_en) return null;
      
      // Strict exclusion of Shop by Age / تسوق حسب العمر from the header
      const lowerEn = label_en.toLowerCase();
      const hasAgeEn = lowerEn.includes("shop by age") || lowerEn.includes("shopbyage");
      const hasAgeAr = label_ar.includes("تسوق حسب العمر") || label_ar.includes("تسوقي حسب العمر") || label_ar.includes("التسوق حسب العمر");
      if (hasAgeEn || hasAgeAr || href.toLowerCase().includes("shop-by-age")) {
        return null;
      }

      return {
        slug: buildSlug(href),
        label_ar,
        label_en,
        href,
      } satisfies HeaderNavItem;
    })
    .filter(Boolean) as HeaderNavItem[];
}

export const isExternalHeaderHref = (href: string) => /^https?:\/\//i.test(href);
