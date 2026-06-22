import type {
  ButtonConfig,
  SectionSettings,
  SectionType,
  ThemeConfig,
  ThemeSection,
} from "./types";

const button = (): ButtonConfig => ({
  text: "Shop now",
  backgroundColor: "#94203a",
  textColor: "#ffffff",
  borderRadius: 12,
  borderColor: "#94203a",
  borderWidth: 1,
  shadow: true,
  fullWidth: false,
  size: "medium",
  variant: "solid",
  url: "/category/all",
});

const copy: Record<SectionType, Pick<SectionSettings, "title" | "subtitle" | "description">> = {
  hero: {
    title: "Little moments, beautifully dressed",
    subtitle: "The new collection",
    description: "Timeless pieces chosen for childhood's loveliest days.",
  },
  product_grid: {
    title: "New arrivals",
    subtitle: "Freshly selected",
    description: "Discover our newest pieces.",
  },
  featured_products: {
    title: "Our favourites",
    subtitle: "Curated for you",
    description: "A small edit of much-loved pieces.",
  },
  categories: {
    title: "Shop by category",
    subtitle: "Find their style",
    description: "Dresses · Gifts · Little essentials",
  },
  banner: {
    title: "A beautiful season",
    subtitle: "Limited collection",
    description: "Made for celebrations and everyday magic.",
  },
  collection: {
    title: "The occasion edit",
    subtitle: "A special collection",
    description: "Elegant silhouettes and delicate details.",
  },
  text: {
    title: "Thoughtfully chosen",
    subtitle: "Our promise",
    description: "Beautiful quality, considered details and a warm shopping experience.",
  },
  image: {
    title: "A closer look",
    subtitle: "Our world",
    description: "Add an image URL to tell your story.",
  },
  cta: {
    title: "Find something lovely",
    subtitle: "Ready to explore?",
    description: "Browse the full collection today.",
  },
  footer: {
    title: "Le Petit Paradis",
    subtitle: "Stay in touch",
    description: "Beautiful childrenswear, delivered with care.",
  },
};

export function createSection(type: SectionType): ThemeSection {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    enabled: true,
    settings: {
      ...copy[type],
      imageUrl: "",
      backgroundColor: "#ffffff",
      textColor: "#1e1e1e",
      columns: type === "categories" ? 3 : 4,
      itemCount: type === "categories" ? 6 : 8,
      button: button(),
    },
  };
}

export const defaultThemeConfig: ThemeConfig = {
  version: 1,
  global: {
    primaryColor: "#94203a",
    secondaryColor: "#f3e1e7",
    backgroundColor: "#fbf6f7",
    textColor: "#1e1e1e",
    cardColor: "#ffffff",
    borderRadius: 14,
    fontSizeScale: 1,
    buttonRadius: 12,
    buttonStyle: "solid",
    spacingScale: 1,
    appBackgroundStyle: "solid",
    headerStyle: "solid",
    productCardStyle: "elevated",
  },
  sections: [
    createSection("hero"),
    createSection("categories"),
    createSection("featured_products"),
    createSection("cta"),
  ],
  updatedAt: new Date(0).toISOString(),
};
