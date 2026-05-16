import type { Bilingual } from "../types";

export type TourStep = {
  /** data-tour selector value, or null for a centered modal step */
  target: string | null;
  title: Bilingual;
  body: Bilingual;
  /** Optional placement hint */
  placement?: "right" | "bottom" | "auto";
};

export const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: { ar: "أهلاً بك في لوحة الإدارة", en: "Welcome to your Admin Panel" },
    body: {
      ar: "سنأخذك في جولة سريعة للتعرّف على أقسام اللوحة وأهم ما يمكنك فعله. يمكنك التخطّي في أي لحظة وإعادة الجولة لاحقاً من زر «بدء الجولة».",
      en: "Let's take a quick tour of the admin sections and what you can do. You can skip at any time and restart the tour later from the “Start tour” button.",
    },
  },
  {
    target: "sidebar",
    title: { ar: "القائمة الجانبية", en: "Sidebar navigation" },
    body: {
      ar: "كل أقسام اللوحة مجمّعة هنا حسب الوظيفة: المبيعات، المنتجات، العملاء، التسويق، المحتوى، العمليات، النظام.",
      en: "All admin sections are grouped here by function: Sales, Catalog, Customers, Marketing, Content, Operations, and System.",
    },
    placement: "right",
  },
  {
    target: "nav:/admin",
    title: { ar: "لوحة المؤشرات", en: "Dashboard" },
    body: {
      ar: "نظرة عامة سريعة: المبيعات، الطلبات، أهم المنتجات، وحالة الموقع.",
      en: "Quick overview: sales, orders, top products, and site health at a glance.",
    },
  },
  {
    target: "nav:/admin/analytics",
    title: { ar: "التحليلات", en: "Analytics" },
    body: {
      ar: "تقارير مفصّلة عن الزوار والتحويل والمبيعات لفهم أداء المتجر.",
      en: "Detailed reports on visitors, conversion, and sales to understand store performance.",
    },
  },
  {
    target: "nav:/admin/orders",
    title: { ar: "الطلبات", en: "Orders" },
    body: {
      ar: "إدارة كل الطلبات: المراجعة، تغيير الحالة، الفواتير، الشحن، والإلغاء.",
      en: "Manage every order: review, change status, generate invoices, ship, or cancel.",
    },
  },
  {
    target: "nav:/admin/products",
    title: { ar: "المنتجات", en: "Products" },
    body: {
      ar: "أضف منتجاتك وعدّلها مع رفع الصور والفيديو مباشرة من جهازك، وإدارة الخيارات والمقاسات والألوان والمخزون.",
      en: "Add and edit products with images and video uploaded directly from your device, plus variants, sizes, colors, and stock management.",
    },
  },
  {
    target: "nav:/admin/categories",
    title: { ar: "التصنيفات", en: "Categories" },
    body: {
      ar: "نظّم منتجاتك في تصنيفات ومجموعات تظهر للعملاء في الصفحة الرئيسية وصفحات التصفّح.",
      en: "Organize products into categories and collections shown to customers on the homepage and browse pages.",
    },
  },
  {
    target: "nav:/admin/inventory",
    title: { ar: "المخزون", en: "Inventory" },
    body: {
      ar: "تتبّع الكميات المتاحة والمنخفضة، واضبط حدود التنبيه التلقائي عند نفاد المخزون.",
      en: "Track on-hand and low stock, and configure automatic alerts when items are running out.",
    },
  },
  {
    target: "nav:/admin/coupons",
    title: { ar: "الكوبونات", en: "Coupons" },
    body: {
      ar: "أنشئ أكواد خصم بنِسب أو مبالغ ثابتة، مع تحديد فترة الصلاحية والحدّ الأدنى للطلب.",
      en: "Create discount codes (percentage or fixed amount) with validity period and minimum order rules.",
    },
  },
  {
    target: "nav:/admin/campaigns",
    title: { ar: "التسويق والحملات", en: "Marketing & Campaigns" },
    body: {
      ar: "أطلق حملات تسويقية وتابع أداءها، وأنشئ صفحات هبوط مخصّصة للحملات.",
      en: "Launch marketing campaigns, track their performance, and build custom landing pages.",
    },
  },
  {
    target: "nav:/admin/customers",
    title: { ar: "العملاء", en: "Customers" },
    body: {
      ar: "اطّلع على ملفات العملاء وطلباتهم وعناوينهم، وتواصل معهم عبر الرسائل وتذاكر الدعم.",
      en: "Browse customer profiles, orders and addresses, and reach them via messages or support tickets.",
    },
  },
  {
    target: "nav:/admin/storefront",
    title: { ar: "محتوى المتجر", en: "Storefront content" },
    body: {
      ar: "تحكّم في بانرات الواجهة، محرّر الصفحة الرئيسية، الأقسام المميّزة، الأكثر رواجاً، الشريط الإعلاني، وصفحات المحتوى.",
      en: "Control storefront banners, the home builder, featured categories, popular picks, the announcement bar, and content pages.",
    },
  },
  {
    target: "nav:/admin/webhooks",
    title: { ar: "الويبهوكس والتكاملات", en: "Webhooks & integrations" },
    body: {
      ar: "اربط متجرك بأنظمة خارجية: الشحن (OTO)، المنصات، والإشعارات عبر Webhooks، مع لوحة لمتابعة صحة التسليم.",
      en: "Integrate with external systems: shipping (OTO), platforms, and notifications via Webhooks, with a delivery health panel.",
    },
  },
  {
    target: "nav:/admin/reports",
    title: { ar: "التقارير والتحليلات", en: "Reports & analytics" },
    body: {
      ar: "تقارير دورية قابلة للجدولة عن المبيعات والمخزون والعملاء والأداء.",
      en: "Schedulable periodic reports for sales, inventory, customers, and performance.",
    },
  },
  {
    target: "nav:/admin/permissions",
    title: { ar: "الأمان والصلاحيات", en: "Security & permissions" },
    body: {
      ar: "أدِر الأدوار والصلاحيات لفريقك، وراجِع سجلّ الأمان ومحاولات الدخول.",
      en: "Manage roles and permissions for your team, and review security logs and login attempts.",
    },
  },
  {
    target: "nav:/admin/settings",
    title: { ar: "الإعدادات", en: "Settings" },
    body: {
      ar: "الإعدادات العامة للمتجر: المعلومات الأساسية، الشحن، المدفوعات، الإشعارات، والخصوصية.",
      en: "General store settings: basics, shipping, payments, notifications, and privacy.",
    },
  },
  {
    target: "tour-restart",
    title: { ar: "أعِد الجولة في أي وقت", en: "Restart anytime" },
    body: {
      ar: "هذا هو زر «بدء الجولة» — يمكنك الضغط عليه في أي وقت لإعادة عرض هذه الجولة. هذا كل شيء، استمتع باستخدام لوحتك!",
      en: "This is the “Start tour” button — click it anytime to replay this tour. That's it, enjoy your admin panel!",
    },
    placement: "bottom",
  },
];
