export type SectionType =
  | "hero"
  | "product_grid"
  | "featured_products"
  | "categories"
  | "banner"
  | "collection"
  | "text"
  | "image"
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
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  backgroundColor: string;
  textColor: string;
  columns: 2 | 3 | 4;
  itemCount: number;
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
