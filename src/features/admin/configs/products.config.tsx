import type { AdminPageConfig } from "@/features/admin/types";

export const productsConfig: AdminPageConfig = {
  title: { ar: "المنتجات", en: "Products" },
  table: "products",
  orderBy: { column: "created_at", ascending: false },
  rowHref: (row) => `/admin/products/${row.id}`,
  columns: [
    { key: "image_url", label: { ar: "الصورة", en: "Image" }, type: "image", width: "w-16" },
    { key: "name_ar", label: { ar: "الاسم العربي", en: "Name (AR)" } },
    { key: "name_en", label: { ar: "الاسم الإنجليزي", en: "Name (EN)" }, hideOnMobile: true },
    { key: "price", label: { ar: "السعر", en: "Price" }, type: "currency" },
    { key: "stock", label: { ar: "المخزون", en: "Stock" }, type: "number" },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    {
      key: "search",
      type: "search",
      columns: ["name_ar", "name_en", "sku"],
      placeholder: { ar: "بحث بالاسم أو SKU...", en: "Search by name or SKU..." },
    },
    {
      key: "is_active",
      type: "select",
      label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "true", label: { ar: "نشط", en: "Active" } },
        { value: "false", label: { ar: "غير نشط", en: "Inactive" } },
      ],
    },
  ],
  actions: { export: true },
};

productsConfig.actions = { ...productsConfig.actions, create: true, edit: true, delete: true };
productsConfig.form = [
  { key: "name_ar", label: { ar: "الاسم العربي", en: "Name (AR)" }, type: "text", required: true, maxLength: 200 },
  { key: "name_en", label: { ar: "الاسم الإنجليزي", en: "Name (EN)" }, type: "text", required: true, maxLength: 200 },
  { key: "slug", label: { ar: "Slug", en: "Slug" }, type: "text", required: true, pattern: "^[a-z0-9-]+$", helpText: { ar: "حروف صغيرة وأرقام وشرطة", en: "lowercase letters, numbers and dashes" } },
  { key: "sku", label: { ar: "SKU الأساسي (للمنتج)", en: "Base SKU (product)" }, type: "text", helpText: { ar: "كود عام للمنتج. لو عندك كود مختلف لكل مقاس، عبّيه في قسم \"المقاسات والأكواد\" بالأسفل.", en: "A general code for the product. If each size has its own code, fill them in the \"Sizes & SKUs\" section below." } },
  { key: "barcode", label: { ar: "الباركود", en: "Barcode" }, type: "text" },
  { key: "brand", label: { ar: "العلامة التجارية", en: "Brand" }, type: "text" },

  { key: "price", label: { ar: "السعر", en: "Price" }, type: "number", required: true, min: 0, step: 0.01 },
  { key: "compare_at_price", label: { ar: "السعر قبل الخصم", en: "Compare-at price" }, type: "number", min: 0, step: 0.01 },
  { key: "cost", label: { ar: "التكلفة", en: "Cost" }, type: "number", min: 0, step: 0.01 },
  { key: "currency", label: { ar: "العملة", en: "Currency" }, type: "text", defaultValue: "SAR", maxLength: 3 },
  { key: "tax_rate", label: { ar: "ضريبة القيمة المضافة", en: "Tax rate" }, type: "number", min: 0, max: 1, step: 0.01, defaultValue: 0.15 },

  {
    key: "categories",
    label: { ar: "التصنيفات الرئيسية", en: "Main categories" },
    type: "lookup",
    fullWidth: true,
    helpText: {
      ar: "اختر تصنيفاً واحداً أو أكثر — المنتج يقدر يكون في عدة تصنيفات (مثلاً: فساتين + الأكثر مبيعاً)",
      en: "Pick one or more categories — a product can belong to many (e.g. Dresses + Best-sellers)",
    },
    lookup: {
      table: "categories",
      multiple: true,
      labelColumns: ["name_ar", "name_en"],
      secondaryColumn: "slug",
      imageColumn: "image_url",
      searchColumns: ["name_ar", "name_en", "slug"],
      filter: { is_active: true },
      limit: 200,
      junction: {
        table: "product_categories",
        ownerColumn: "product_id",
        itemColumn: "category_id",
      },
    },
  },

  { key: "stock", label: { ar: "المخزون الإجمالي (يحسب تلقائياً من المستودعات)", en: "Total stock (auto from warehouses)" }, type: "number", min: 0, defaultValue: 0, helpText: { ar: "يتم تحديثه تلقائياً عند توزيع المخزون على المستودعات", en: "Auto-synced from warehouse inventory" } },
  { key: "low_stock_threshold", label: { ar: "حد المخزون المنخفض", en: "Low stock threshold" }, type: "number", min: 0, defaultValue: 5 },
  { key: "warehouse_stock", label: { ar: "توزيع المخزون على المستودعات", en: "Stock per warehouse" }, type: "warehouseStock", fullWidth: true, helpText: { ar: "اختر المستودعات التي يتوفر فيها المنتج وحدد الكمية لكل مستودع", en: "Pick the warehouses that carry this product and set the quantity for each" } },
  { key: "weight", label: { ar: "الوزن (كجم)", en: "Weight (kg)" }, type: "number", min: 0, step: 0.01 },

  {
    key: "images",
    label: { ar: "صور المنتج (اسحب لإعادة الترتيب — الأولى هي الرئيسية)", en: "Product images (drag to reorder — first is main)" },
    type: "gallery",
    bucket: "product-media",
    folder: "gallery",
    maxItems: 20,
    fullWidth: true,
    syncMainTo: "image_url",
    helpText: {
      ar: "ارفع كل صور المنتج هنا. أول صورة هي الصورة الرئيسية اللي تظهر في كرت المنتج وأعلى الصفحة، وبقية الصور تظهر في معرض المنتج. تقدر تسحب لإعادة الترتيب.",
      en: "Upload all product images here. The first image becomes the main shown on the card and gallery cover; reorder by drag.",
    },
  },
  { key: "video_url", label: { ar: "الفيديو الرئيسي", en: "Main video" }, type: "video", bucket: "product-media", folder: "videos" },
  { key: "videos", label: { ar: "معرض الفيديوهات", en: "Video gallery" }, type: "videoGallery", bucket: "product-media", folder: "videos", maxItems: 10 },
  { key: "image_alt", label: { ar: "وصف الصورة (alt)", en: "Image alt" }, type: "text" },

  {
    key: "sizeSkus",
    label: { ar: "المقاسات والأكواد (SKU لكل مقاس)", en: "Sizes & SKUs (one SKU per size)" },
    type: "productSizes",
    fullWidth: true,
    helpText: {
      ar: "لكل مقاس/عمر كود (SKU) وسعر وكمية مستقلة. هذي المقاسات تظهر للعميل في صفحة المنتج، والكود ينتقل مع الطلب.",
      en: "Each size/age gets its own SKU, price and quantity. These sizes appear to the customer on the product page and the SKU flows through to the order.",
    },
  },

  {
    key: "variants",
    label: { ar: "الألوان والمتغيّرات", en: "Colours & Variants" },
    type: "productVariants",
    fullWidth: true,
    helpText: {
      ar: "أضف الألوان المتاحة للمنتج. لكل لون اختر صورة وكود لون — لما يضغط العميل على اللون في المتجر تتبدّل الصورة تلقائياً.",
      en: "Add available colours. Each colour can have its own image — when the shopper picks a colour, the gallery swaps to that image.",
    },
  },

  {
    key: "attributes",
    label: { ar: "تصنيفات فرعية (عمر، شكل، خامة …)", en: "Sub-attributes (age, shape, material …)" },
    type: "productAttributes",
    fullWidth: true,
    helpText: {
      ar: "أضف خصائص مرنة مثل العمر والشكل والمناسبة — تستخدم لفلترة البحث في المتجر.",
      en: "Add flexible attributes like age, shape, occasion — used for search/filter in the storefront.",
    },
  },

  { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", required: true, defaultValue: "active", options: [
    { value: "active", label: { ar: "نشط", en: "Active" } },
    { value: "draft", label: { ar: "مسودة", en: "Draft" } },
    { value: "archived", label: { ar: "مؤرشف", en: "Archived" } },
  ]},
  { key: "product_type", label: { ar: "نوع المنتج", en: "Product type" }, type: "select", defaultValue: "physical", options: [
    { value: "physical", label: { ar: "مادي", en: "Physical" } },
    { value: "digital", label: { ar: "رقمي", en: "Digital" } },
    { value: "service", label: { ar: "خدمة", en: "Service" } },
  ]},
  { key: "is_active", label: { ar: "نشط في المتجر", en: "Visible in store" }, type: "boolean", defaultValue: true },
  { key: "allow_preorder", label: { ar: "السماح بالطلب المسبق", en: "Allow preorder" }, type: "boolean" },
  { key: "hide_when_out_of_stock", label: { ar: "إخفاء عند نفاد المخزون", en: "Hide when out of stock" }, type: "boolean" },

  { key: "short_description_ar", label: { ar: "وصف مختصر (AR)", en: "Short description (AR)" }, type: "textarea", rows: 2 },
  { key: "short_description_en", label: { ar: "وصف مختصر (EN)", en: "Short description (EN)" }, type: "textarea", rows: 2 },
  { key: "description_ar", label: { ar: "الوصف (AR)", en: "Description (AR)" }, type: "textarea", rows: 5 },
  { key: "description_en", label: { ar: "الوصف (EN)", en: "Description (EN)" }, type: "textarea", rows: 5 },
  { key: "meta_title", label: { ar: "Meta Title", en: "Meta Title" }, type: "text" },
  { key: "meta_description", label: { ar: "Meta Description", en: "Meta Description" }, type: "textarea", rows: 2 },
];
