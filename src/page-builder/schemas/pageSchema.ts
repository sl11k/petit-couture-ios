// Page Builder content schema.
// All editable pages are stored as { sections: Section[] } in cms_pages.draft_content / published_content.

export type DeviceVisibility = {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
};

export type SectionSpacing = {
  paddingTop?: number;
  paddingBottom?: number;
};

export type CommonSectionSettings = {
  spacing?: SectionSpacing;
  backgroundColor?: string;
  visibility?: DeviceVisibility;
};

export type ButtonContent = {
  label_ar?: string;
  label_en?: string;
  url?: string;
  variant?: "primary" | "secondary" | "ghost";
  newTab?: boolean;
};

export type ImageContent = {
  url?: string;
  alt?: string;
};

// --- Section variants ---

export type LegacyHomeSection = {
  id: string;
  type: "legacy_home";
  content: Record<string, never>;
  settings?: CommonSectionSettings;
};

export type HeroSection = {
  id: string;
  type: "hero";
  content: {
    eyebrow_ar?: string;
    eyebrow_en?: string;
    title_ar?: string;
    title_en?: string;
    subtitle_ar?: string;
    subtitle_en?: string;
    image?: ImageContent;
    buttons?: ButtonContent[];
    alignment?: "left" | "center" | "right";
  };
  settings?: CommonSectionSettings & {
    backgroundType?: "color" | "image" | "gradient";
    backgroundImage?: string;
    overlay?: number; // 0..1
  };
};

export type TextBlockSection = {
  id: string;
  type: "text_block";
  content: {
    title_ar?: string;
    title_en?: string;
    body_ar?: string;
    body_en?: string;
    alignment?: "left" | "center" | "right";
  };
  settings?: CommonSectionSettings;
};

export type ImageTextSection = {
  id: string;
  type: "image_text";
  content: {
    title_ar?: string;
    title_en?: string;
    body_ar?: string;
    body_en?: string;
    image?: ImageContent;
    imageSide?: "left" | "right";
    button?: ButtonContent;
  };
  settings?: CommonSectionSettings;
};

export type FeatureCard = {
  id: string;
  icon?: string; // lucide icon name
  title_ar?: string;
  title_en?: string;
  description_ar?: string;
  description_en?: string;
  link?: string;
};

export type FeatureGridSection = {
  id: string;
  type: "feature_grid";
  content: {
    title_ar?: string;
    title_en?: string;
    subtitle_ar?: string;
    subtitle_en?: string;
    columns?: 2 | 3 | 4;
    cards: FeatureCard[];
  };
  settings?: CommonSectionSettings;
};

export type FaqItem = {
  id: string;
  question_ar?: string;
  question_en?: string;
  answer_ar?: string;
  answer_en?: string;
};

export type FaqSection = {
  id: string;
  type: "faq";
  content: {
    title_ar?: string;
    title_en?: string;
    items: FaqItem[];
  };
  settings?: CommonSectionSettings;
};

export type TestimonialItem = {
  id: string;
  name?: string;
  role_ar?: string;
  role_en?: string;
  quote_ar?: string;
  quote_en?: string;
  avatar?: string;
};

export type TestimonialsSection = {
  id: string;
  type: "testimonials";
  content: {
    title_ar?: string;
    title_en?: string;
    items: TestimonialItem[];
  };
  settings?: CommonSectionSettings;
};

export type CtaSection = {
  id: string;
  type: "cta";
  content: {
    title_ar?: string;
    title_en?: string;
    subtitle_ar?: string;
    subtitle_en?: string;
    buttons?: ButtonContent[];
    alignment?: "left" | "center" | "right";
  };
  settings?: CommonSectionSettings;
};

export type GallerySection = {
  id: string;
  type: "gallery";
  content: {
    title_ar?: string;
    title_en?: string;
    images: ImageContent[];
    columns?: 2 | 3 | 4;
  };
  settings?: CommonSectionSettings;
};

export type BeforeAfterSection = {
  id: string;
  type: "before_after";
  content: {
    title_ar?: string;
    title_en?: string;
    beforeImage?: ImageContent;
    afterImage?: ImageContent;
    beforeLabel_ar?: string;
    beforeLabel_en?: string;
    afterLabel_ar?: string;
    afterLabel_en?: string;
    layout?: "slider" | "side_by_side";
    imageHeight?: number;
  };
  settings?: CommonSectionSettings;
};

export type StatItem = {
  id: string;
  value?: string;
  label_ar?: string;
  label_en?: string;
};

export type StatsSection = {
  id: string;
  type: "stats";
  content: {
    items: StatItem[];
  };
  settings?: CommonSectionSettings;
};

export type ReviewsSection = {
  id: string;
  type: "reviews";
  content: {
    title_ar?: string;
    title_en?: string;
    limit?: number;
    minRating?: number;
    columns?: 2 | 3 | 4;
  };
  settings?: CommonSectionSettings;
};

// --- New universal blocks ---

export type ButtonSection = {
  id: string;
  type: "button";
  content: {
    button: ButtonContent;
    alignment?: "left" | "center" | "right";
    size?: "sm" | "md" | "lg" | "xl";
    shape?: "square" | "rounded" | "pill";
    fullWidth?: boolean;
  };
  settings?: CommonSectionSettings;
};

export type BannerSection = {
  id: string;
  type: "banner";
  content: {
    image?: ImageContent;
    title_ar?: string;
    title_en?: string;
    subtitle_ar?: string;
    subtitle_en?: string;
    button?: ButtonContent;
    height?: "sm" | "md" | "lg" | "xl";
    overlay?: number;
    alignment?: "left" | "center" | "right";
    shape?: "square" | "rounded" | "pill";
    textColor?: string;
  };
  settings?: CommonSectionSettings;
};

export type ProductGridSection = {
  id: string;
  type: "product_grid";
  content: {
    title_ar?: string;
    title_en?: string;
    source?: "category" | "manual" | "newest";
    categorySlug?: string;
    productSlugs?: string[];
    limit?: number;
    columns?: 2 | 3 | 4 | 5;
    cardShape?: "square" | "rounded";
    showPrice?: boolean;
  };
  settings?: CommonSectionSettings;
};

export type DividerSection = {
  id: string;
  type: "divider";
  content: {
    style?: "solid" | "dashed" | "dotted";
    color?: string;
    thickness?: number;
    width?: number;
  };
  settings?: CommonSectionSettings;
};

export type SpacerSection = {
  id: string;
  type: "spacer";
  content: { height?: number };
  settings?: CommonSectionSettings;
};

export type HtmlSection = {
  id: string;
  type: "html";
  content: { html?: string };
  settings?: CommonSectionSettings;
};

export type Section =
  | LegacyHomeSection
  | HeroSection
  | TextBlockSection
  | ImageTextSection
  | FeatureGridSection
  | FaqSection
  | TestimonialsSection
  | CtaSection
  | GallerySection
  | BeforeAfterSection
  | StatsSection
  | ReviewsSection
  | ButtonSection
  | BannerSection
  | ProductGridSection
  | DividerSection
  | SpacerSection
  | HtmlSection;

export type SectionType = Section["type"];

export type PageContent = {
  sections: Section[];
};

export type CmsPage = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  type: "home" | "about" | "contact" | "custom" | "landing";
  status: "draft" | "published";
  draft_content: PageContent;
  published_content: PageContent | null;
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
  og_image_url: string | null;
  noindex: boolean;
  canonical_url: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export const EMPTY_PAGE_CONTENT: PageContent = { sections: [] };

export function isPageContent(v: unknown): v is PageContent {
  return !!v && typeof v === "object" && Array.isArray((v as PageContent).sections);
}
