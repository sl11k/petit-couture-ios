import { useState, type ImgHTMLAttributes } from "react";

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
}

/**
 * Drop-in <img> replacement that:
 *  - Defaults to loading="lazy" + decoding="async"
 *  - Uses fetchpriority="high" + decoding="sync" + loading="eager" when `eager`
 *  - Reserves layout space (no CLS) via `aspect` and/or width/height
 *  - Fades in once the image decodes
 *  - Smooth on iOS scroll (no main-thread decode for above-the-fold)
 */
export function LazyImage({
  src,
  alt,
  eager,
  aspect,
  width,
  height,
  className = "",
  style,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
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
