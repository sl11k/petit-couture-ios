// Theme runtime: load active theme from DB and inject as CSS variables.
import { supabase } from "@/integrations/supabase/client";

export type ThemeColors = Record<string, string>;
export type ThemeFonts = { sans?: string; serif?: string; arabic?: string };
export type ThemeBranding = {
  logo_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
  site_name?: string;
};
export type ThemeComponents = {
  button_radius?: string;
  button_style?: "filled" | "outline" | "soft";
  card_radius?: string;
  card_style?: "elevated" | "flat" | "outlined";
  header_style?: "solid" | "transparent" | "minimal";
  header_sticky?: boolean;
  footer_style?: "rich" | "minimal" | "centered";
  home_layout?: "classic" | "magazine" | "boutique";
};
export type ThemeTokens = {
  radius_base?: string;
  spacing_unit?: string;
  shadow_intensity?: "none" | "soft" | "strong";
};

export type Theme = {
  id: string;
  name: string;
  is_active: boolean;
  colors: ThemeColors;
  fonts: ThemeFonts;
  branding: ThemeBranding;
  components: ThemeComponents;
  tokens: ThemeTokens;
};

let cachedTheme: Theme | null = null;

export async function loadActiveTheme(): Promise<Theme | null> {
  if (cachedTheme) return cachedTheme;
  const { data } = await supabase
    .from("site_themes")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  cachedTheme = data as unknown as Theme;
  return cachedTheme;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  
  // Apply colors as CSS variables
  const c = theme.colors ?? {};
  for (const [key, val] of Object.entries(c)) {
    const cssVar = "--" + key.replace(/_/g, "-");
    root.style.setProperty(cssVar, val as string);
  }
  
  // Apply fonts
  if (theme.fonts?.sans) root.style.setProperty("--font-sans", theme.fonts.sans);
  if (theme.fonts?.serif) root.style.setProperty("--font-serif", theme.fonts.serif);
  
  // Apply tokens
  if (theme.tokens?.radius_base) root.style.setProperty("--radius", theme.tokens.radius_base);
  if (theme.components?.button_radius)
    root.style.setProperty("--button-radius", theme.components.button_radius);
  if (theme.components?.card_radius)
    root.style.setProperty("--card-radius", theme.components.card_radius);

  // Apply favicon
  if (theme.branding?.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = theme.branding.favicon_url;
  }
  
  // Apply site name
  if (theme.branding?.site_name) {
    document.documentElement.dataset.siteName = theme.branding.site_name;
  }
}

export function clearThemeCache() {
  cachedTheme = null;
}

// Validation: prevent obviously broken values that would crash the design.
export function validateTheme(t: Partial<Theme>): string[] {
  const errs: string[] = [];
  const hslRe = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/;
  for (const [k, v] of Object.entries(t.colors ?? {})) {
    if (typeof v !== "string" || !hslRe.test(v.trim())) {
      errs.push(`اللون ${k} يجب أن يكون بصيغة HSL مثل "30 50% 45%"`);
    }
  }
  if (t.components?.button_radius && !/^[\d.]+(rem|px)$/.test(t.components.button_radius))
    errs.push("نصف قطر الزر غير صالح");
  if (t.components?.card_radius && !/^[\d.]+(rem|px)$/.test(t.components.card_radius))
    errs.push("نصف قطر الكرت غير صالح");
  return errs;
}

// Section types catalog
export const SECTION_TYPES = [
  { key: "hero", label: "Hero Banner" },
  { key: "slider", label: "Slider" },
  { key: "categories_grid", label: "Categories Grid" },
  { key: "featured_products", label: "Featured Products" },
  { key: "best_sellers", label: "Best Sellers" },
  { key: "offers", label: "Offers" },
  { key: "testimonials", label: "Testimonials" },
  { key: "brand_logos", label: "Brand Logos" },
  { key: "faq", label: "FAQ" },
  { key: "newsletter", label: "Newsletter" },
  { key: "custom_html", label: "Custom HTML" },
] as const;

// Safe HTML allow-list for custom_html sections
const ALLOWED_TAGS = new Set([
  "p", "span", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "img", "br", "strong", "em", "b", "i", "u", "small",
  "blockquote", "hr", "figure", "figcaption", "video", "source",
]);
const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "class", "id", "target", "rel",
  "width", "height", "loading", "controls", "poster", "type",
]);

export function sanitizeHtml(input: string): string {
  if (typeof window === "undefined") return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = input;
  const walk = (node: Element) => {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      node.replaceWith(document.createTextNode(node.textContent ?? ""));
      return;
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value;
      if (!ALLOWED_ATTRS.has(name) || /^javascript:/i.test(val) || /^data:/i.test(val)) {
        node.removeAttribute(attr.name);
      }
    }
    for (const child of Array.from(node.children)) walk(child);
  };
  for (const el of Array.from(tpl.content.children)) walk(el);
  return tpl.innerHTML;
}

export async function saveRevision(
  entity_type: "theme" | "page" | "section",
  entity_id: string,
  snapshot: any,
  note?: string
) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("site_revisions").insert({
    entity_type, entity_id, snapshot, note,
    created_by: u.user?.id, created_by_email: u.user?.email,
  });
}
