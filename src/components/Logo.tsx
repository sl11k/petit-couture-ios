import logoSrc from "@/assets/lpp-logo-transparent.png";

type Props = { className?: string; height?: number; alt?: string };

export function BrandLogo({ className, height = 36, alt = "Le Petit Paradis" }: Props) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      height={height}
      style={{ height }}
      className={className}
      decoding="sync"
      loading="eager"
    />
  );
}

export const BRAND_NAME = "Le Petit Paradis";
export const BRAND_NAME_AR = "لو بوتي باراديس";
