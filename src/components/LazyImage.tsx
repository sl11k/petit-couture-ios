import { useState, type ImgHTMLAttributes } from "react";
import { productImg, productSrcSet, productSizes, type ImgSize } from "@/lib/productImage";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Set true only for above-the-fold hero images (LCP candidates). */
  eager?: boolean;
  /** CSS aspect-ratio, e.g. "1/1", "4/5". Pair with width/height for zero-CLS. */
  aspect?: string;
  /** Intrinsic width in pixels. Required for native aspect-ratio + zero CLS. */
  width?: number;
  /** Intrinsic height in pixels. Required for native aspect-ratio + zero CLS. */
  height?: number;
  /**
   * When set, request an optimized/resized copy from Supabase Storage
   * (thumb ~200px, small ~320px, medium ~600px, large ~1000px, xlarge ~1600px)
   * and emit a 1x/2x/3x srcSet automatically. Falls back to the original URL
   * for non-Supabase sources.
   */
  size?: ImgSize;
}

/**
 * Drop-in <img> replacement that:
 *  - Defaults to loading="lazy" + decoding="async"
 *  - Uses fetchpriority="high" + decoding="sync" + loading="eager" when `eager`
 *  - Reserves layout space (no CLS) via `aspect` and/or width/height
 *  - Fades in once the image decodes
 *  - Smooth on iOS scroll (no main-thread decode for above-the-fold)
 *  - Serves resized/optimized copies via Supabase image transformations
 *    when `size` is provided (thumb / small / medium / large / xlarge)
 */
export function LazyImage({
  src,
  alt,
  eager,
  aspect,
  width,
  height,
  size,
  srcSet,
  sizes,
  className = "",
  style,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const resolvedSrc = size ? productImg(src, size) : src;
  const resolvedSrcSet = srcSet ?? (size ? productSrcSet(src, size) : undefined);
  const resolvedSizes = sizes ?? (size ? `${productSizes(size)}px` : undefined);
  return (
    <img
      src={resolvedSrc}
      srcSet={resolvedSrcSet}
      sizes={resolvedSizes}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      fetchPriority={eager ? "high" : "low"}
      onLoad={() => setLoaded(true)}
      className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
      style={{ aspectRatio: aspect, ...style }}
      {...rest}
    />
  );
}
