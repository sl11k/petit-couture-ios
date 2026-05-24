import type { AdminDetailConfig } from "@/features/admin/types";
import { productsConfig } from "./products.config";
import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";

export const productDetailConfig: AdminDetailConfig = {
  table: "products",
  backTo: "/admin/products",
  backLabel: { ar: "العودة للمنتجات", en: "Back to products" },
  title: (row) => ({ ar: row.name_ar ?? "—", en: row.name_en ?? "—" }),
  description: (row) => ({
    ar: `SKU: ${row.sku ?? "—"} • ${row.brand ?? ""}`,
    en: `SKU: ${row.sku ?? "—"} • ${row.brand ?? ""}`,
  }),
  editForm: productsConfig.form,
  sections: [
    {
      title: { ar: "نظرة عامة", en: "Overview" },
      fields: [
        { key: "image_url", label: { ar: "الصورة الرئيسية", en: "Main image" }, type: "image", span: 2 },
        { key: "name_ar", label: { ar: "الاسم (AR)", en: "Name (AR)" } },
        { key: "name_en", label: { ar: "الاسم (EN)", en: "Name (EN)" } },
        { key: "slug", label: { ar: "Slug", en: "Slug" } },
        { key: "brand", label: { ar: "العلامة", en: "Brand" } },
        { key: "sku", label: { ar: "SKU", en: "SKU" } },
        { key: "barcode", label: { ar: "الباركود", en: "Barcode" } },
      ],
    },
    {
      title: { ar: "السعر والمخزون", en: "Pricing & inventory" },
      columns: 3,
      fields: [
        { key: "price", label: { ar: "السعر", en: "Price" }, type: "currency" },
        { key: "compare_at_price", label: { ar: "قبل الخصم", en: "Compare at" }, type: "currency", hideIfEmpty: true },
        { key: "cost", label: { ar: "التكلفة", en: "Cost" }, type: "currency", hideIfEmpty: true },
        { key: "currency", label: { ar: "العملة", en: "Currency" } },
        { key: "tax_rate", label: { ar: "الضريبة", en: "Tax rate" }, type: "number" },
        { key: "stock", label: { ar: "المخزون", en: "Stock" }, type: "number" },
        { key: "reserved_stock", label: { ar: "محجوز", en: "Reserved" }, type: "number" },
        { key: "low_stock_threshold", label: { ar: "حد منخفض", en: "Low threshold" }, type: "number" },
        { key: "weight", label: { ar: "الوزن (كجم)", en: "Weight (kg)" }, type: "number", hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "الحالة", en: "Status" },
      columns: 3,
      fields: [
        { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
        { key: "product_type", label: { ar: "النوع", en: "Type" }, type: "badge" },
        { key: "is_active", label: { ar: "نشط في المتجر", en: "Visible" }, type: "boolean" },
        { key: "allow_preorder", label: { ar: "طلب مسبق", en: "Preorder" }, type: "boolean" },
        { key: "hide_when_out_of_stock", label: { ar: "إخفاء عند النفاد", en: "Hide when OOS" }, type: "boolean" },
        { key: "deduct_on", label: { ar: "خصم عند", en: "Deduct on" }, type: "badge" },
      ],
    },
    {
      title: { ar: "الوصف", en: "Description" },
      columns: 1,
      fields: [
        { key: "short_description_ar", label: { ar: "وصف مختصر (AR)", en: "Short (AR)" }, type: "longtext", hideIfEmpty: true },
        { key: "short_description_en", label: { ar: "وصف مختصر (EN)", en: "Short (EN)" }, type: "longtext", hideIfEmpty: true },
        { key: "description_ar", label: { ar: "الوصف (AR)", en: "Description (AR)" }, type: "longtext", hideIfEmpty: true },
        { key: "description_en", label: { ar: "الوصف (EN)", en: "Description (EN)" }, type: "longtext", hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "المتغيرات والوسائط", en: "Variants & media" },
      columns: 1,
      fields: [
        { key: "sizes", label: { ar: "المقاسات", en: "Sizes" }, type: "json", hideIfEmpty: true },
        { key: "colors", label: { ar: "الألوان", en: "Colors" }, type: "json", hideIfEmpty: true },
        { key: "images", label: { ar: "صور إضافية", en: "Images" }, type: "json", hideIfEmpty: true },
        { key: "video_url", label: { ar: "رابط الفيديو", en: "Video URL" }, type: "url", hideIfEmpty: true },
      ],
    },
    {
      title: { ar: "SEO", en: "SEO" },
      fields: [
        { key: "meta_title", label: { ar: "Meta Title", en: "Meta title" }, hideIfEmpty: true },
        { key: "image_alt", label: { ar: "Alt الصورة", en: "Image alt" }, hideIfEmpty: true },
        { key: "meta_description", label: { ar: "Meta Description", en: "Meta description" }, type: "longtext", span: 2, hideIfEmpty: true },
        { key: "og_image", label: { ar: "OG Image", en: "OG image" }, type: "url", span: 2, hideIfEmpty: true },
      ],
    },
    // Sidebar
    {
      sidebar: true,
      title: { ar: "إحصاءات", en: "Stats" },
      columns: 1,
      fields: [
        { key: "views_count", label: { ar: "المشاهدات", en: "Views" }, type: "number" },
        { key: "sales_count", label: { ar: "المبيعات", en: "Sales" }, type: "number" },
        { key: "created_at", label: { ar: "أُنشئ", en: "Created" }, type: "datetime" },
        { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime" },
        { key: "publish_at", label: { ar: "ينشر في", en: "Publish at" }, type: "datetime", hideIfEmpty: true },
        { key: "sale_starts_at", label: { ar: "تخفيض يبدأ", en: "Sale starts" }, type: "datetime", hideIfEmpty: true },
        { key: "sale_ends_at", label: { ar: "تخفيض ينتهي", en: "Sale ends" }, type: "datetime", hideIfEmpty: true },
      ],
    },
  ],
  related: [
    {
      title: { ar: "آخر المبيعات", en: "Recent sales" },
      table: "order_items",
      foreignKey: "product_id",
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
      columns: [
        { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
        { key: "size", label: { ar: "المقاس", en: "Size" }, hideOnMobile: true },
        { key: "color", label: { ar: "اللون", en: "Color" }, hideOnMobile: true },
        { key: "qty", label: { ar: "الكمية", en: "Qty" }, type: "number" },
        { key: "unit_price", label: { ar: "السعر", en: "Price" }, type: "currency" },
        { key: "line_total", label: { ar: "الإجمالي", en: "Total" }, type: "currency" },
      ],
      rowHref: (r) => `/admin/orders/${r.order_id}`,
      emptyMessage: { ar: "لا توجد مبيعات بعد", en: "No sales yet" },
    },
  ],
};
