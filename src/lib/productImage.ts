/**
 * Product image size variants using Supabase Storage image transformations.
 *
 * Supabase serves on-the-fly resized/optimized copies via the render/image
 * endpoint (globally cached at the CDN edge), so we don't need to pre-generate
 * physical thumb/medium/large files at upload time — every product image
 * automatically gets multiple sizes on first request.
 *
 * Usage:
 *   <img src={productImg(url, "thumb")} srcSet={productSrcSet(url, "medium")} />
 *   or via <LazyImage size="thumb" src={url} />
 */

export type ImgSize = "thumb" | "small" | "medium" | "large" | "xlarge";

const SIZES: Record<ImgSize, { w: number; q: number }> = {
  thumb: { w: 200, q: 70 },   // grid thumbnails, cart line items
  small: { w: 320, q: 72 },   // small cards, related products
  medium: { w: 600, q: 75 },  // main product cards
  large: { w: 1000, q: 80 },  // product detail hero
  xlarge: { w: 1600, q: 82 }, // zoom / fullscreen
};

const OBJECT_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";

function isSupabaseStorage(url: string) {
  return typeof url === "string" && (url.includes(OBJECT_MARKER) || url.includes(RENDER_MARKER));
}

function toRender(url: string): string | null {
  if (!isSupabaseStorage(url)) return null;
  if (url.includes(RENDER_MARKER)) {
    // Already a render URL; strip existing query so we can set our own.
    return url.split("?")[0];
  }
  return url.replace(OBJECT_MARKER, RENDER_MARKER).split("?")[0];
}

/** Return a resized/optimized URL for the given size, or the original if not transformable. */
export function productImg(url: string | null | undefined, size: ImgSize = "medium"): string {
  if (!url) return "";
  const base = toRender(url);
  if (!base) return url;
  const { w, q } = SIZES[size];
  return `${base}?width=${w}&quality=${q}&resize=cover`;
}

/** Return a responsive srcSet across 1x/2x/3x for the given base size. */
export function productSrcSet(url: string | null | undefined, size: ImgSize = "medium"): string | undefined {
  if (!url) return undefined;
  const base = toRender(url);
  if (!base) return undefined;
  const { w, q } = SIZES[size];
  return [1, 2, 3]
    .map((dpr) => `${base}?width=${w * dpr}&quality=${q}&resize=cover ${dpr}x`)
    .join(", ");
}

export function productSizes(size: ImgSize): number {
  return SIZES[size].w;
}
