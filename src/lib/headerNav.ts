import { supabase } from "@/integrations/supabase/client";

export type HeaderNavItem = {
  slug: string;
  label_ar: string;
  label_en: string;
  href: string;
};

// Top-level segments that map to real native routes. Any other single-segment
// internal href (e.g. /about, /faq) is assumed to point at a CMS page and is
// rewritten to /page/<slug> so admin-defined header links never 404.
const NATIVE_TOP_SEGMENTS = new Set([
  "account", "bag", "cart", "category", "checkout", "collection", "contact",
  "forgot-password", "help", "invoice", "landing", "login", "order-confirmation",
  "our-story", "page", "privacy", "product", "register", "reset-password",
  "search", "shipping", "sitemap.xml", "robots.txt", "support", "track-order",
  "unsubscribe", "wishlist",
]);

const normalizeHref = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const [pathOnly, ...rest] = withSlash.split(/[?#]/);
  const segments = pathOnly.split("/").filter(Boolean);
  const suffix = rest.length ? withSlash.slice(pathOnly.length) : "";
  if (segments.length === 0) return "/";
  const first = segments[0].toLowerCase();
  if (NATIVE_TOP_SEGMENTS.has(first)) return withSlash;
  // Unknown single-segment → CMS page route
  if (segments.length === 1) return `/page/${segments[0]}${suffix}`;
  return withSlash;
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
