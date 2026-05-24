import type { AdminPageConfig } from "@/features/admin/types";

export const warehousesConfig: AdminPageConfig = {
  title: { ar: "المستودعات", en: "Warehouses" },
  description: {
    ar: "إدارة مستودعات التخزين والكميات المتاحة في كل موقع",
    en: "Manage storage warehouses and the stock available at each location",
  },
  table: "warehouses",
  orderBy: { column: "priority", ascending: true },
  rowHref: (row) => `/admin/warehouses/${row.id}`,
  columns: [
    { key: "code", label: { ar: "الكود", en: "Code" }, width: "w-24" },
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "country_code", label: { ar: "الدولة", en: "Country" }, hideOnMobile: true, width: "w-20" },
    { key: "city", label: { ar: "المدينة", en: "City" }, hideOnMobile: true },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "number", hideOnMobile: true, width: "w-24" },
    {
      key: "status",
      label: { ar: "الحالة", en: "Status" },
      render: (v) =>
        v === "active" ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            نشط
          </span>
        ) : (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            متوقف
          </span>
        ),
    },
    {
      key: "product_count",
      label: { ar: "عدد المنتجات", en: "Products" },
      type: "number",
      hideOnMobile: true,
    },
    {
      key: "available_quantity",
      label: { ar: "المتاح", en: "Available" },
      type: "number",
    },
    {
      key: "low_stock_count",
      label: { ar: "مخزون منخفض", en: "Low stock" },
      hideOnMobile: true,
      render: (v) => {
        const n = Number(v ?? 0);
        if (n === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {n}
          </span>
        );
      },
    },
  ],
  filters: [
    {
      key: "search",
      type: "search",
      columns: ["code", "name", "name_en", "city", "region"],
      placeholder: { ar: "بحث بالاسم أو الكود...", en: "Search by name or code..." },
    },
    {
      key: "status",
      type: "select",
      label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "active", label: { ar: "نشط", en: "Active" } },
        { value: "inactive", label: { ar: "متوقف", en: "Inactive" } },
      ],
    },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
  form: [
    {
      key: "code",
      label: { ar: "الكود", en: "Code" },
      type: "text",
      required: true,
      maxLength: 30,
      pattern: "^[A-Z0-9_-]+$",
      helpText: {
        ar: "أحرف كبيرة وأرقام وشرطة فقط (مثال: RUH, JED)",
        en: "Uppercase letters, numbers and dashes only (e.g. RUH, JED)",
      },
    },
    { key: "name", label: { ar: "الاسم بالعربية", en: "Name (AR)" }, type: "text", required: true, maxLength: 120 },
    { key: "name_en", label: { ar: "الاسم بالإنجليزية", en: "Name (EN)" }, type: "text", maxLength: 120 },
    {
      key: "status",
      label: { ar: "الحالة", en: "Status" },
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { value: "active", label: { ar: "نشط", en: "Active" } },
        { value: "inactive", label: { ar: "متوقف", en: "Inactive" } },
      ],
    },
    {
      key: "priority",
      label: { ar: "الأولوية", en: "Priority" },
      type: "number",
      min: 0,
      defaultValue: 100,
      helpText: {
        ar: "كلما قل الرقم زادت أولوية المستودع عند توزيع الطلبات",
        en: "Lower number = higher priority when fulfilling orders",
      },
    },
    { key: "country_code", label: { ar: "كود الدولة", en: "Country code" }, type: "text", maxLength: 2, defaultValue: "SA", helpText: { ar: "ISO مكوّن من حرفين (SA, AE, ...)", en: "Two-letter ISO code (SA, AE, ...)" } },
    { key: "region", label: { ar: "المنطقة", en: "Region" }, type: "text", maxLength: 80 },
    { key: "city", label: { ar: "المدينة", en: "City" }, type: "text", maxLength: 80 },
    { key: "address", label: { ar: "العنوان", en: "Address" }, type: "textarea", rows: 2 },
    { key: "latitude", label: { ar: "خط العرض", en: "Latitude" }, type: "number", step: 0.000001, helpText: { ar: "اختياري — يستخدم لاحقاً لاختيار المستودع الأقرب للعميل", en: "Optional — used later to pick the warehouse closest to the customer" } },
    { key: "longitude", label: { ar: "خط الطول", en: "Longitude" }, type: "number", step: 0.000001 },
    { key: "notes", label: { ar: "ملاحظات", en: "Notes" }, type: "textarea", rows: 2 },
  ],
  /**
   * Enrich each warehouse row with stats from get_warehouse_stats().
   * Falls back to zeros if the RPC fails (e.g. permissions).
   */
  enrichRows: async (rows) => {
    if (!rows.length) return rows;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.rpc("get_warehouse_stats" as any);
      const byId = new Map<string, any>((data ?? []).map((r: any) => [r.warehouse_id, r]));
      return rows.map((r: any) => {
        const s = byId.get(r.id) ?? {};
        return {
          ...r,
          product_count: Number(s.product_count ?? 0),
          available_quantity: Number(s.available_quantity ?? 0),
          low_stock_count: Number(s.low_stock_count ?? 0),
          out_of_stock_count: Number(s.out_of_stock_count ?? 0),
        };
      });
    } catch {
      return rows.map((r: any) => ({
        ...r,
        product_count: 0,
        available_quantity: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
      }));
    }
  },
};
