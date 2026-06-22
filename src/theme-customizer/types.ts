export type SectionType =
  | "announcement"
  | "marquee"
  | "hero"
  | "slideshow"
  | "product_grid"
  | "featured_products"
  | "categories"
  | "banner"
  | "collection"
  | "text"
  | "image"
  | "image_text"
  | "video"
  | "gallery"
  | "features"
  | "stats"
  | "testimonials"
  | "reviews"
  | "logo_cloud"
  | "instagram"
  | "newsletter"
  | "countdown"
  | "faq"
  | "divider"
  | "spacer"
  | "cta"
  | "footer";
export type ButtonVariant = "solid" | "outline" | "ghost" | "glass";

export interface ButtonConfig {
  text: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
  shadow: boolean;
  fullWidth: boolean;
  size: "small" | "medium" | "large";
  variant: ButtonVariant;
  url: string;
}

export interface SectionSettings {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  secondaryImageUrl: string;
  videoUrl: string;
  itemsText: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  columns: 2 | 3 | 4 | 5;
  itemCount: number;
  alignment: "left" | "center" | "right";
  layout: "classic" | "split" | "boxed" | "full" | "cards";
  imagePosition: "left" | "right" | "background";
  paddingY: number;
  minHeight: number;
  maxWidth: number;
  gap: number;
  borderRadius: number;
  overlayOpacity: number;
  autoplay: boolean;
  showPrice: boolean;
  button: ButtonConfig;
}

export interface ThemeSection {
  id: string;
  type: SectionType;
  enabled: boolean;
  settings: SectionSettings;
}

export interface GlobalThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  cardColor: string;
  borderRadius: number;
  fontSizeScale: number;
  buttonRadius: number;
  buttonStyle: ButtonVariant;
  spacingScale: number;
  appBackgroundStyle: "solid" | "soft-gradient";
  headerStyle: "solid" | "transparent" | "minimal";
  productCardStyle: "elevated" | "flat" | "outlined";
}

export interface ThemeConfig {
  version: 1;
  global: GlobalThemeSettings;
  sections: ThemeSection[];
  updatedAt: string;
}
