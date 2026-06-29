import { supabase } from "@/integrations/supabase/client";

export type HeaderNavItem = {
  slug: string;
  label_ar: string;
  label_en: string;
  href: string;
};

const normalizeHref = (value: string | null | undefined) => {
  const href = String(value ?? "").trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return href.startsWith("/") ? href : `/${href}`;
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
