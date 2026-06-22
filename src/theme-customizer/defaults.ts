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
  announcement: {
    title: "Free delivery over 500 SAR",
    subtitle: "Store update",
    description: "Use this slim bar for shipping, launches or important news.",
  },
  marquee: {
    title: "NEW ARRIVALS  ·  TIMELESS STYLE  ·  BEAUTIFUL DETAILS",
    subtitle: "Moving message",
    description: "A continuously moving brand or campaign message.",
  },
  hero: {
    title: "Little moments, beautifully dressed",
    subtitle: "The new collection",
    description: "Timeless pieces chosen for childhood's loveliest days.",
  },
  slideshow: {
    title: "Stories worth celebrating",
    subtitle: "Campaign slides",
    description: "Create a cinematic rotating campaign header.",
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
  image_text: {
    title: "Made for little moments",
    subtitle: "Editorial story",
    description: "Pair an image with a thoughtful piece of copy.",
  },
  video: {
    title: "See the collection in motion",
    subtitle: "Campaign film",
    description: "Add a hosted video URL for an immersive story.",
  },
  gallery: {
    title: "The lookbook",
    subtitle: "Visual gallery",
    description: "Add image URLs as separate lines below.",
  },
  features: {
    title: "Why families choose us",
    subtitle: "Our promises",
    description: "Premium quality\nFast delivery\nEasy returns\nPersonal support",
  },
  stats: {
    title: "Loved across the region",
    subtitle: "By the numbers",
    description: "10K+ Happy families\n24h Dispatch\n4.9/5 Rating\n14d Returns",
  },
  testimonials: {
    title: "Kind words",
    subtitle: "Customer stories",
    description:
      "Beautiful quality — Sara\nThe packaging was magical — Nora\nWonderful service — Reem",
  },
  reviews: {
    title: "Recent reviews",
    subtitle: "Loved by you",
    description: "Showcase social proof and customer feedback.",
  },
  logo_cloud: {
    title: "Selected brands",
    subtitle: "Our partners",
    description: "Mayoral\nTartine et Chocolat\nPatachou\nPetit Bateau\nJacadi",
  },
  instagram: {
    title: "Follow our world",
    subtitle: "@lepetitparadis",
    description: "Add social image URLs as separate lines below.",
  },
  newsletter: {
    title: "A little note from us",
    subtitle: "Stay inspired",
    description: "Receive new arrivals, stories and private offers.",
  },
  countdown: {
    title: "The private edit arrives soon",
    subtitle: "Launching shortly",
    description: "2026-12-31T20:00:00",
  },
  faq: {
    title: "Frequently asked questions",
    subtitle: "Need help?",
    description:
      "How long is delivery?|Usually 1–3 business days.\nCan I return an item?|Returns are accepted within 14 days.\nDo you gift wrap?|Yes, select gift wrapping at checkout.",
  },
  divider: {
    title: "Divider",
    subtitle: "",
    description: "A subtle visual break between sections.",
  },
  spacer: {
    title: "Spacer",
    subtitle: "",
    description: "Add intentional breathing room between sections.",
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

const itemDefaults: Partial<Record<SectionType, string>> = {
  categories: "Dresses\nNewborn\nGifts\nShoes\nBags\nNew in\nSets\nSale",
  features: "Premium quality\nFast delivery\nEasy returns\nPersonal support",
  stats: "10K+|Happy families\n24h|Dispatch\n4.9/5|Rating\n14d|Returns",
  testimonials: "Beautiful quality|Sara\nThe packaging was magical|Nora\nWonderful service|Reem",
  reviews: "★★★★★|Perfect quality\n★★★★★|Fast and beautiful\n★★★★★|Lovely packaging",
  logo_cloud: "Mayoral\nTartine et Chocolat\nPatachou\nPetit Bateau\nJacadi",
  gallery: "",
  instagram: "",
  faq: "How long is delivery?|Usually 1–3 business days.\nCan I return an item?|Returns are accepted within 14 days.\nDo you gift wrap?|Yes, select gift wrapping at checkout.",
};

export function createSection(type: SectionType): ThemeSection {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    enabled: true,
    settings: {
      ...copy[type],
      badge: "",
      imageUrl: "",
      secondaryImageUrl: "",
      videoUrl: "",
      itemsText: itemDefaults[type] ?? copy[type].description,
      backgroundColor: "#ffffff",
      textColor: "#1e1e1e",
      accentColor: "#94203a",
      columns: type === "categories" ? 3 : 4,
      itemCount: type === "categories" ? 6 : 8,
      alignment: "center",
      layout: ["hero", "banner", "slideshow"].includes(type) ? "full" : "classic",
      imagePosition: "background",
      paddingY: type === "announcement" || type === "marquee" ? 14 : type === "spacer" ? 48 : 72,
      minHeight: ["hero", "banner", "slideshow", "collection"].includes(type) ? 560 : 0,
      maxWidth: 1240,
      gap: 18,
      borderRadius: 14,
      overlayOpacity: 28,
      autoplay: true,
      showPrice: true,
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

export function normalizeThemeConfig(value: ThemeConfig): ThemeConfig {
  return {
    ...defaultThemeConfig,
    ...value,
    global: { ...defaultThemeConfig.global, ...value.global },
    sections: value.sections.map((section) => {
      const base = createSection(section.type);
      return {
        ...base,
        ...section,
        settings: {
          ...base.settings,
          ...section.settings,
          button: { ...base.settings.button, ...section.settings?.button },
        },
      };
    }),
  };
}
