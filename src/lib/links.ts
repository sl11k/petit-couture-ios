const NATIVE_TOP_SEGMENTS = new Set([
  "account",
  "bag",
  "cart",
  "category",
  "checkout",
  "collection",
  "contact",
  "forgot-password",
  "help",
  "invoice",
  "landing",
  "login",
  "order-confirmation",
  "our-story",
  "page",
  "privacy",
  "product",
  "register",
  "reset-password",
  "search",
  "shipping",
  "sitemap.xml",
  "robots.txt",
  "support",
  "track-order",
  "unsubscribe",
  "wishlist",
]);

function decodeRouteTarget(value: string) {
  const raw = value.trim();
  const candidates = [raw, raw.replace(/^\//, "")];
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (lower.startsWith("page/route:")) {
      const encoded = candidate.slice("page/route:".length);
      const decoded = decodeURIComponent(encoded);
      return decoded.startsWith("/") ? decoded : `/${decoded}`;
    }
    if (lower.startsWith("route:")) {
      const encoded = candidate.slice("route:".length);
      const decoded = decodeURIComponent(encoded);
      return decoded.startsWith("/") ? decoded : `/${decoded}`;
    }
  }
  return null;
}

export function normalizeInternalHref(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;

  try {
    const routeTarget = decodeRouteTarget(raw);
    if (routeTarget) return routeTarget;
  } catch {
    /* Keep the original value if it is malformed. */
  }

  const href = raw.startsWith("/") ? raw : `/${raw}`;
  const [pathOnly] = href.split(/[?#]/);
  const suffix = href.slice(pathOnly.length);
  const segments = pathOnly.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  const first = segments[0].toLowerCase();
  if (NATIVE_TOP_SEGMENTS.has(first)) return href;
  if (segments.length === 1) return `/page/${segments[0]}${suffix}`;
  return href;
}

export const isExternalHref = (href: string) => /^https?:\/\//i.test(href);
