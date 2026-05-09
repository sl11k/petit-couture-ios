# إعادة بناء لوحة الادمن من الصفر — Config-driven Architecture

نظراً لأن هناك **~55 صفحة admin** في المشروع، الحذف وإعادة البناء دفعة واحدة سيكون عملاً ضخماً (آلاف الأسطر) ويحتمل أن يكسر روابط ومراجع كثيرة. لذلك سنقسّم العمل على **مراحل واضحة**.

---

## البنية الجديدة المقترحة

```text
src/
├── routes/admin/                  ← كل صفحات الادمن هنا (تنظيم أنظف)
│   ├── route.tsx                  ← Layout موحّد + AuthGuard + Sidebar
│   ├── index.tsx                  ← Dashboard
│   ├── orders/
│   │   ├── index.tsx              ← config فقط (≈30 سطر)
│   │   └── $id.tsx                ← صفحة تفاصيل
│   ├── products/index.tsx
│   ├── customers/index.tsx
│   └── ... باقي الصفحات
│
├── features/admin/                ← المكوّنات والمنطق المشترك
│   ├── components/
│   │   ├── AdminPage.tsx          ← المكوّن العام (يأخذ config ويرسم كل شيء)
│   │   ├── DataTable.tsx          ← جدول قابل لإعادة الاستخدام
│   │   ├── FilterBar.tsx          ← شريط فلاتر
│   │   ├── PageHeader.tsx         ← عنوان + actions
│   │   ├── FormDialog.tsx         ← نموذج إضافة/تعديل
│   │   ├── EmptyState.tsx
│   │   └── StatusBadge.tsx
│   ├── hooks/
│   │   ├── useAdminTable.ts       ← جلب + فلترة + ترقيم
│   │   └── useAdminMutation.ts    ← إنشاء/تحديث/حذف موحّد
│   ├── types.ts                   ← أنواع AdminPageConfig, ColumnDef, FilterDef
│   └── sidebar/
│       ├── AdminSidebar.tsx
│       └── nav.config.ts          ← قائمة الروابط في مكان واحد
```

### مثال على ملف صفحة (Config-driven)

```tsx
// src/routes/admin/coupons/index.tsx
export const Route = createFileRoute("/admin/coupons/")({
  component: () => <AdminPage config={couponsConfig} />,
});

const couponsConfig: AdminPageConfig = {
  title: { ar: "الكوبونات", en: "Coupons" },
  table: "coupons",
  columns: [
    { key: "code", label: { ar: "الكود", en: "Code" } },
    { key: "discount", label: { ar: "الخصم", en: "Discount" }, render: (v) => `${v}%` },
    { key: "is_active", type: "badge" },
  ],
  filters: [
    { key: "is_active", type: "select", options: [...] },
    { key: "search", type: "text", columns: ["code"] },
  ],
  form: [
    { key: "code", type: "text", required: true },
    { key: "discount", type: "number", required: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};
```

تعديل أي صفحة = تعديل ملف config صغير. إضافة عمود = سطر واحد.

---

## خطة التنفيذ على مراحل

### المرحلة 1 — البنية الأساسية (هذه الجولة)
1. حذف **كل** ملفات `src/routes/admin.*.tsx` و `src/components/AdminLayout.tsx`.
2. حذف الملفات المساعدة المرتبطة بالادمن فقط (`adminDict.ts` يبقى).
3. إنشاء `features/admin/` بكل المكونات المشتركة (AdminPage, DataTable, FilterBar, FormDialog, PageHeader, Sidebar).
4. إنشاء `src/routes/admin/route.tsx` كـ Layout مع AuthGuard.
5. إعادة بناء **6 صفحات أساسية** كنماذج تشغيلية:
   - Dashboard (`/admin`)
   - Orders + Order detail
   - Products + Product detail
   - Customers + Customer detail
   - Categories
   - Settings
6. تعطيل الروابط في الـ Sidebar للصفحات غير المُعاد بناؤها بعد (مع شارة "قريباً").

### المرحلة 2 (جولة لاحقة)
- Coupons, Inventory, Returns, Invoices, Payments, Shipping, Reports, Analytics.

### المرحلة 3 (جولة لاحقة)
- Audit, Security, Users, Notifications, Messages, Integrations, OTO, Webhooks, Errors, Performance.

### المرحلة 4 (جولة لاحقة)
- Storefront, Home Builder, Landing Pages, Collections, Content, Campaigns, Search, Help, Support, States, Privacy, Site Analytics, Conversion, Abandoned/Incomplete, Create Order.

---

## ما سيتأثر

- **روابط داخلية**: أي مكوّن يربط مثل `<Link to="/admin/xxx">` سيستمر بالعمل لأن المسارات نفسها (تحت `/admin`).
- **قاعدة البيانات**: لن تُمَس إطلاقاً. RLS وكل الجداول كما هي.
- **APIs والـ edge functions**: لن تُمَس.
- **routeTree.gen.ts**: يُولَّد تلقائياً.

---

## ما أحتاج تأكيدك عليه

1. هل الموافقة على تنفيذ **المرحلة 1 فقط الآن** (البنية + 6 صفحات)، ثم نكمل البقية في رسائل لاحقة؟ هذا ضروري لأن محاولة بناء 55 صفحة دفعة واحدة سيستغرق وقتاً طويلاً جداً وقد تنكسر أمور.
2. هل تريد أن تكون مسارات الادمن بنفس الـ URLs الحالية تماماً (`/admin/orders`, `/admin/products`, ...) — **هذا هو الافتراضي**.
3. الصفحات غير المُعاد بناؤها في المرحلة 1 ستظهر مؤقتاً كصفحة "قيد التطوير" — موافق؟

أكّد لي وسأبدأ مباشرة بالمرحلة 1.