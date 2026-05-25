// src/features/admin/configs/nav.config.tsx
//
// Admin pages for the three storefront navigation surfaces:
//   1. headerNavConfig          → top header links (البوتيك / فساتين / ...)
//   2. shopByCategoryConfig     → homepage tile grid "تسوقي حسب الفئة"
//   3. seasonPicksConfig        → curated row "الأكثر شهرة - مختارات الموسم"
//
// All three use the shared AdminPage + FormDialog pattern, with the new
// "lookup" field type pointing at the categories / products tables so the
// admin never has to paste a UUID.
import type { AdminPageConfig } from "@/features/admin/types";

const yesNo = [
  { value: "true", label: { ar: "نعم", en: "Yes" } },
  { value: "false", label: { ar: "لا", en: "No" } },
];

const categoryLookup = {
  table: "categories",
  labelColumns: ["name_ar", "name_en"],
  secondaryColumn: "slug",
  imageColumn: "image_url",
  searchColumns: ["name_ar", "name_en", "slug"],
  filter: { is_active: true },
  limit: 100,
} as const;

const productLookup = {
  table: "products",
  labelColumns: ["name_ar", "name_en"],
  secondaryColumn: "sku",
  imageColumn: "image_url",
  searchColumns: ["name_ar", "name_en", "sku"],
  filter: { is_active: true },
  limit: 100,
} as const;

// ──────────────────── 1. HEADER NAV ────────────────────
// Roles: top-bar links visible on every page.
// Examples in your store today:
//   البوتيك → /
//   الأكثر مبيعًا → /category/best-sellers
//   فساتين → /category/dresses
export const headerNavConfig: AdminPageConfig = {
  title: { ar: "روابط الهيدر", en: "Header Navigation" },
  description: {
    ar: "روابط الشريط العلوي للموقع. اسحب الترتيب لتغيير ترتيب الظهور.",
    en: "Top-bar links shown on every page. Lower order numbers appear first.",
  },
  table: "header_nav_items",
  orderBy: { column: "display_order", ascending: true },
  columns: [
    { key: "display_order", label: { ar: "#", en: "#" }, type: "number", width: "w-12" },
    { key: "label_ar", label: { ar: "النص (عربي)", en: "Label (AR)" } },
    { key: "label_en", label: { ar: "النص (إنجليزي)", en: "Label (EN)" }, hideOnMobile: true },
    { key: "href", label: { ar: "الرابط", en: "URL" } },
    { key: "open_in_new", label: { ar: "تبويب جديد", en: "New tab" }, type: "boolean", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["label_ar", "label_en", "href"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "label_ar", label: { ar: "النص بالعربية", en: "Label (AR)" }, type: "text", required: true, maxLength: 80 },
    { key: "label_en", label: { ar: "النص بالإنجليزية", en: "Label (EN)" }, type: "text", required: true, maxLength: 80 },
    {
      key: "category_id",
      label: { ar: "تصنيف مرتبط (اختياري)", en: "Linked category (optional)" },
      type: "lookup",
      lookup: categoryLookup,
      helpText: {
        ar: "اختر تصنيفاً ليولِّد الرابط تلقائياً، أو اكتب الرابط يدوياً تحت.",
        en: "Pick a category to auto-fill the URL, or set a custom URL below.",
      },
    },
    {
      key: "href",
      label: { ar: "الرابط", en: "URL" },
      type: "text",
      required: true,
      placeholder: { ar: "/ أو /category/dresses", en: "/ or /category/dresses" },
      helpText: {
        ar: "ابدأ بـ / للروابط الداخلية، أو ضع رابطاً كاملاً للخارجية",
        en: "Start with / for internal links, full URL for external",
      },
    },
    { key: "open_in_new", label: { ar: "افتح في تبويب جديد", en: "Open in new tab" }, type: "boolean", defaultValue: false },
    {
      key: "display_order",
      label: { ar: "ترتيب الظهور", en: "Display order" },
      type: "number",
      defaultValue: 100,
      helpText: { ar: "أرقام أقل تظهر أولاً", en: "Lower numbers appear first" },
    },
    { key: "is_active", label: { ar: "ظاهر في الموقع", en: "Visible" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ──────────────────── 2. SHOP BY CATEGORY ────────────────────
// "تسوقي حسب الفئة" — the homepage tile grid.
// Each tile = an image + a title + a destination (category or custom URL).
export const shopByCategoryConfig: AdminPageConfig = {
  title: { ar: "تسوقي حسب الفئة", en: "Shop by Category" },
  description: {
    ar: "البلاطات المربعة في الصفحة الرئيسية تحت عنوان \"تسوقي حسب الفئة\".",
    en: "The square tiles on the homepage under \"Shop by Category\".",
  },
  table: "shop_by_category_items",
  orderBy: { column: "display_order", ascending: true },
  columns: [
    { key: "image_url", label: { ar: "الصورة", en: "Image" }, type: "image", width: "w-16" },
    { key: "title_ar", label: { ar: "العنوان (عربي)", en: "Title (AR)" } },
    { key: "title_en", label: { ar: "العنوان (إنجليزي)", en: "Title (EN)" }, hideOnMobile: true },
    { key: "display_order", label: { ar: "#", en: "#" }, type: "number", width: "w-16", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["title_ar", "title_en"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "title_ar", label: { ar: "العنوان بالعربية", en: "Title (AR)" }, type: "text", required: true, maxLength: 80 },
    { key: "title_en", label: { ar: "العنوان بالإنجليزية", en: "Title (EN)" }, type: "text", required: true, maxLength: 80 },
    {
      key: "image_url",
      label: { ar: "صورة البلاطة (مربعة)", en: "Tile image (square)" },
      type: "image",
      required: true,
      bucket: "category-media",
      folder: "shop-by-category",
      helpText: { ar: "يفضّل صورة مربعة عالية الجودة", en: "A high-quality square image is preferred" },
    },
    {
      key: "category_id",
      label: { ar: "التصنيف الذي تذهب إليه البلاطة", en: "Destination category" },
      type: "lookup",
      lookup: categoryLookup,
      helpText: {
        ar: "اختر تصنيفاً ليولِّد رابطاً تلقائياً، أو حدد رابطاً مخصصاً أدناه",
        en: "Pick a category to auto-link, or set a custom URL below",
      },
    },
    {
      key: "href",
      label: { ar: "رابط مخصص (اختياري)", en: "Custom URL (optional)" },
      type: "text",
      placeholder: { ar: "/category/dresses", en: "/category/dresses" },
    },
    { key: "display_order", label: { ar: "ترتيب البلاطة", en: "Display order" }, type: "number", defaultValue: 100 },
    { key: "is_active", label: { ar: "ظاهرة في الموقع", en: "Visible" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ──────────────────── 3. SEASON PICKS ────────────────────
// "الأكثر شهرة - مختارات الموسم" — a curated row of featured products.
export const seasonPicksConfig: AdminPageConfig = {
  title: { ar: "مختارات الموسم", en: "Season Picks" },
  description: {
    ar: "المنتجات المختارة لعرضها في قسم \"الأكثر شهرة - مختارات الموسم\" بالصفحة الرئيسية.",
    en: "Featured products shown under \"Most popular - Season Picks\" on the homepage.",
  },
  table: "season_picks",
  orderBy: { column: "display_order", ascending: true },
  columns: [
    { key: "product_id", label: { ar: "المنتج", en: "Product" } },
    { key: "title_ar", label: { ar: "العنوان", en: "Heading" }, hideOnMobile: true },
    { key: "badge_ar", label: { ar: "الشارة", en: "Badge" }, type: "badge", hideOnMobile: true },
    { key: "display_order", label: { ar: "#", en: "#" }, type: "number", width: "w-16" },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    {
      key: "product_id",
      label: { ar: "المنتج", en: "Product" },
      type: "lookup",
      required: true,
      lookup: productLookup,
      helpText: { ar: "ابحث عن المنتج بالاسم أو SKU", en: "Search by product name or SKU" },
    },
    {
      key: "title_ar",
      label: { ar: "عنوان القسم بالعربية", en: "Section heading (AR)" },
      type: "text",
      defaultValue: "مختارات الموسم",
      maxLength: 80,
    },
    {
      key: "title_en",
      label: { ar: "عنوان القسم بالإنجليزية", en: "Section heading (EN)" },
      type: "text",
      defaultValue: "Season Picks",
      maxLength: 80,
    },
    { key: "subtitle_ar", label: { ar: "وصف صغير (عربي)", en: "Subtitle (AR)" }, type: "text" },
    { key: "subtitle_en", label: { ar: "وصف صغير (إنجليزي)", en: "Subtitle (EN)" }, type: "text" },
    {
      key: "badge_ar",
      label: { ar: "شارة (عربية) — اختياري", en: "Badge (AR) — optional" },
      type: "text",
      placeholder: { ar: "الأكثر شهرة", en: "Most popular" },
      maxLength: 32,
    },
    {
      key: "badge_en",
      label: { ar: "شارة (إنجليزية) — اختياري", en: "Badge (EN) — optional" },
      type: "text",
      placeholder: { ar: "Most popular", en: "Most popular" },
      maxLength: 32,
    },
    { key: "display_order", label: { ar: "ترتيب العرض", en: "Display order" }, type: "number", defaultValue: 100 },
    { key: "is_active", label: { ar: "ظاهر في الموقع", en: "Visible" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

