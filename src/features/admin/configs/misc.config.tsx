import type { AdminPageConfig } from "@/features/admin/types";
import { Eye } from "lucide-react";

export const customersConfig: AdminPageConfig = {
  title: { ar: "العملاء", en: "Customers" },
  table: "profiles",
  orderBy: { column: "created_at", ascending: false },
  rowHref: (row) => `/admin/customers/${row.id}`,
  columns: [
    { key: "full_name", label: { ar: "الاسم", en: "Name" } },
    { key: "email", label: { ar: "الإيميل", en: "Email" } },
    { key: "phone", label: { ar: "الهاتف", en: "Phone" }, hideOnMobile: true },
    { key: "created_at", label: { ar: "تاريخ التسجيل", en: "Joined" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    {
      key: "search",
      type: "search",
      columns: ["full_name", "email", "phone"],
      placeholder: { ar: "بحث...", en: "Search..." },
    },
  ],
  actions: { export: true },
  rowActions: [
    {
      key: "view",
      label: { ar: "عرض", en: "View" },
      icon: <Eye className="h-3.5 w-3.5" />,
      to: (row) => `/admin/customers/${row.id}`,
    },
  ],
};

export const categoriesConfig: AdminPageConfig = {
  title: { ar: "التصنيفات", en: "Categories" },
  table: "categories",
  // BUGFIX: was "sort_order" — column does not exist in the categories table.
  // Form uses display_order so we sort by the same column.
  orderBy: { column: "display_order", ascending: true },
  columns: [
    { key: "image_url", label: { ar: "الصورة", en: "Image" }, type: "image", width: "w-16" },
    { key: "name_ar", label: { ar: "العربي", en: "Arabic" } },
    { key: "name_en", label: { ar: "الإنجليزي", en: "English" } },
    { key: "slug", label: { ar: "Slug", en: "Slug" }, hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name_ar", "name_en", "slug"] },
  ],
  actions: { export: true },
};

categoriesConfig.actions = { ...categoriesConfig.actions, create: true, edit: true, delete: true };
categoriesConfig.form = [
  { key: "name_ar", label: { ar: "الاسم (AR)", en: "Name (AR)" }, type: "text", required: true, maxLength: 120 },
  { key: "name_en", label: { ar: "الاسم (EN)", en: "Name (EN)" }, type: "text", required: true, maxLength: 120 },
  { key: "slug", label: { ar: "Slug", en: "Slug" }, type: "text", required: true, pattern: "^[a-z0-9-]+$" },
  { key: "icon", label: { ar: "أيقونة", en: "Icon" }, type: "text" },
  { key: "image_url", label: { ar: "صورة التصنيف", en: "Category image" }, type: "image", bucket: "category-media", folder: "thumb" },
  { key: "image_alt", label: { ar: "وصف الصورة", en: "Image alt" }, type: "text" },
  { key: "banner_url", label: { ar: "صورة البانر", en: "Banner image" }, type: "image", bucket: "category-media", folder: "banner" },
  { key: "banner_link", label: { ar: "رابط نقر البانر", en: "Banner link" }, type: "url" },
  { key: "display_order", label: { ar: "الترتيب", en: "Sort order" }, type: "number", min: 0, defaultValue: 0 },
  { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  { key: "description_ar", label: { ar: "الوصف (AR)", en: "Description (AR)" }, type: "textarea", rows: 3 },
  { key: "description_en", label: { ar: "الوصف (EN)", en: "Description (EN)" }, type: "textarea", rows: 3 },
  { key: "meta_title", label: { ar: "Meta Title", en: "Meta Title" }, type: "text" },
  { key: "meta_description", label: { ar: "Meta Description", en: "Meta Description" }, type: "textarea", rows: 2 },
];

customersConfig.actions = { ...customersConfig.actions, edit: true };
customersConfig.form = [
  { key: "full_name", label: { ar: "الاسم الكامل", en: "Full name" }, type: "text", required: true, maxLength: 120 },
  { key: "email", label: { ar: "البريد الإلكتروني", en: "Email" }, type: "email", editOnly: true },
  { key: "phone", label: { ar: "الهاتف", en: "Phone" }, type: "tel" },
];
