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
  orderBy: { column: "sort_order", ascending: true },
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
