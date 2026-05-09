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
