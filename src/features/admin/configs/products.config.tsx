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
      columns: ["name_ar", "name_en"],
      placeholder: { ar: "بحث بالاسم...", en: "Search by name..." },
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
  { key: "sku", label: { ar: "SKU", en: "SKU" }, type: "text" },
  { key: "barcode", label: { ar: "الباركود", en: "Barcode" }, type: "text" },
  { key: "brand", label: { ar: "العلامة التجارية", en: "Brand" }, type: "text" },
  { key: "price", label: { ar: "السعر", en: "Price" }, type: "number", required: true, min: 0, step: 0.01 },
  { key: "compare_at_price", label: { ar: "السعر قبل الخصم", en: "Compare-at price" }, type: "number", min: 0, step: 0.01 },
  { key: "cost", label: { ar: "التكلفة", en: "Cost" }, type: "number", min: 0, step: 0.01 },
  { key: "currency", label: { ar: "العملة", en: "Currency" }, type: "text", defaultValue: "SAR", maxLength: 3 },
  { key: "tax_rate", label: { ar: "ضريبة القيمة المضافة", en: "Tax rate" }, type: "number", min: 0, max: 1, step: 0.01, defaultValue: 0.15 },
  { key: "stock", label: { ar: "المخزون الإجمالي (يحسب تلقائياً من المستودعات)", en: "Total stock (auto from warehouses)" }, type: "number", min: 0, defaultValue: 0, helpText: { ar: "يتم تحديثه تلقائياً عند توزيع المخزون على المستودعات", en: "Auto-synced from warehouse inventory" } },
  { key: "low_stock_threshold", label: { ar: "حد المخزون المنخفض", en: "Low stock threshold" }, type: "number", min: 0, defaultValue: 5 },
  { key: "warehouse_stock", label: { ar: "توزيع المخزون على المستودعات", en: "Stock per warehouse" }, type: "warehouseStock", fullWidth: true, helpText: { ar: "اختر المستودعات التي يتوفر فيها المنتج وحدد الكمية لكل مستودع", en: "Pick the warehouses that carry this product and set the quantity for each" } },
  { key: "weight", label: { ar: "الوزن (كجم)", en: "Weight (kg)" }, type: "number", min: 0, step: 0.01 },
  { key: "image_url", label: { ar: "الصورة الرئيسية", en: "Main image" }, type: "image", bucket: "product-media", folder: "main", helpText: { ar: "ارفع صورة من جهازك أو الصق رابطاً", en: "Upload from your device or paste a URL" } },
  { key: "images", label: { ar: "معرض الصور", en: "Image gallery" }, type: "gallery", bucket: "product-media", folder: "gallery", maxItems: 20 },
  { key: "video_url", label: { ar: "الفيديو الرئيسي", en: "Main video" }, type: "video", bucket: "product-media", folder: "videos" },
  { key: "videos", label: { ar: "معرض الفيديوهات", en: "Video gallery" }, type: "videoGallery", bucket: "product-media", folder: "videos", maxItems: 10 },
  { key: "image_alt", label: { ar: "وصف الصورة (alt)", en: "Image alt" }, type: "text" },
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
