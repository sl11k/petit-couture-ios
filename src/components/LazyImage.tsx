import { useState, type ImgHTMLAttributes } from "react";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Set true only for above-the-fold hero images */
  eager?: boolean;
  aspect?: string; // e.g. "1/1", "4/5"
}

/**
 * Drop-in <img> replacement that:
 *  - Defaults to loading="lazy" + decoding="async"
 *  - Sets fetchpriority/decoding hints
 *  - Reserves layout space (no CLS) when `aspect` is provided
 *  - Fades in once the image decodes
 */
export function LazyImage({ src, alt, eager, aspect, className = "", style, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "low"}
      onLoad={() => setLoaded(true)}
      className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
      style={{ aspectRatio: aspect, ...style }}
      {...rest}
    />
  );
}
