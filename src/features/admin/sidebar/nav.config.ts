import {
  LayoutDashboard, ShoppingBag, Package, FolderTree, Boxes, Users, ShoppingCart,
  CreditCard, Truck, Undo2, Ticket, Megaphone, FileText, Layout, BarChart3, Bell,
  MessageSquare, Headphones, Plug, Settings, Shield, ScrollText, LifeBuoy, Search,
  Plus, AlertCircle, FileSpreadsheet, Activity, Globe, Eye, Mail, Webhook,
  Sparkles, MenuSquare,
  type LucideIcon,
} from "lucide-react";
import type { Bilingual } from "../types";

export type NavItem = {
  to: string;
  label: Bilingual;
  icon: LucideIcon;
  comingSoon?: boolean;
};

export type NavGroup = {
  label: Bilingual;
  items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    label: { ar: "نظرة عامة", en: "Overview" },
    items: [
      { to: "/admin", label: { ar: "لوحة التحكم", en: "Dashboard" }, icon: LayoutDashboard },
      { to: "/admin/analytics", label: { ar: "التحليلات", en: "Analytics" }, icon: BarChart3 },
      { to: "/admin/metrics", label: { ar: "المؤشرات", en: "Metrics" }, icon: Activity },
    ],
  },
  {
    label: { ar: "المبيعات", en: "Sales" },
    items: [
      { to: "/admin/orders", label: { ar: "الطلبات", en: "Orders" }, icon: ShoppingBag },
      { to: "/admin/create-order", label: { ar: "إنشاء طلب", en: "Create order" }, icon: Plus },
      { to: "/admin/abandoned", label: { ar: "السلال المتروكة", en: "Abandoned carts" }, icon: ShoppingCart },
      { to: "/admin/incomplete", label: { ar: "غير مكتملة", en: "Incomplete" }, icon: AlertCircle },
      { to: "/admin/invoices", label: { ar: "الفواتير", en: "Invoices" }, icon: FileSpreadsheet },
      { to: "/admin/payments", label: { ar: "المدفوعات", en: "Payments" }, icon: CreditCard },
      { to: "/admin/returns", label: { ar: "المرتجعات", en: "Returns" }, icon: Undo2 },
    ],
  },
  {
    label: { ar: "المنتجات", en: "Catalog" },
    items: [
      { to: "/admin/products", label: { ar: "المنتجات", en: "Products" }, icon: Package },
      { to: "/admin/categories", label: { ar: "التصنيفات", en: "Categories" }, icon: FolderTree },
      { to: "/admin/inventory", label: { ar: "المخزون", en: "Inventory" }, icon: Boxes },
      { to: "/admin/size-skus", label: { ar: "أكواد المقاسات", en: "Size SKUs" }, icon: FileSpreadsheet },
      { to: "/admin/warehouses", label: { ar: "المستودعات", en: "Warehouses" }, icon: Boxes },
      { to: "/admin/bundles", label: { ar: "الباقات", en: "Bundles" }, icon: Boxes },
      { to: "/admin/product-offers", label: { ar: "عروض المنتجات", en: "Product offers" }, icon: Ticket },
      { to: "/admin/product-relations", label: { ar: "المنتجات المرتبطة", en: "Product relations" }, icon: Package },
      { to: "/admin/reviews", label: { ar: "التقييمات", en: "Reviews" }, icon: MessageSquare },
      { to: "/admin/coupons", label: { ar: "الكوبونات", en: "Coupons" }, icon: Ticket },
    ],
  },
  {
    label: { ar: "العملاء", en: "Customers" },
    items: [
      { to: "/admin/customers", label: { ar: "العملاء", en: "Customers" }, icon: Users },
      { to: "/admin/users", label: { ar: "المستخدمون", en: "Users" }, icon: Users },
      { to: "/admin/loyalty", label: { ar: "نقاط الولاء", en: "Loyalty" }, icon: Activity },
      { to: "/admin/loyalty-transactions", label: { ar: "حركات الولاء", en: "Loyalty txns" }, icon: ScrollText },
      { to: "/admin/referrals", label: { ar: "الإحالات", en: "Referrals" }, icon: Users },
      { to: "/admin/messages", label: { ar: "الرسائل", en: "Messages" }, icon: MessageSquare },
      { to: "/admin/notifications", label: { ar: "الإشعارات", en: "Notifications" }, icon: Bell },
      { to: "/admin/notification-rules", label: { ar: "قواعد الإشعارات", en: "Notification rules" }, icon: Bell },
      { to: "/admin/notification-templates", label: { ar: "قوالب الإشعارات", en: "Notification templates" }, icon: Mail },
      { to: "/admin/support", label: { ar: "الدعم", en: "Support" }, icon: Headphones },
    ],
  },
  {
    label: { ar: "التسويق", en: "Marketing" },
    items: [
      { to: "/admin/campaigns", label: { ar: "الحملات", en: "Campaigns" }, icon: Megaphone },
      { to: "/admin/landing-pages", label: { ar: "صفحات الهبوط", en: "Landing pages" }, icon: Globe },
      { to: "/admin/ab-tests", label: { ar: "اختبارات A/B", en: "A/B tests" }, icon: Activity },
      { to: "/admin/conversion", label: { ar: "التحويل", en: "Conversion" }, icon: Activity },
      { to: "/admin/search", label: { ar: "البحث", en: "Search" }, icon: Search },
    ],
  },
  {
    label: { ar: "المحتوى", en: "Content" },
    items: [
      { to: "/admin/header-nav", label: { ar: "روابط الهيدر", en: "Header navigation" }, icon: MenuSquare },
      { to: "/admin/shop-by-category", label: { ar: "تسوقي حسب الفئة", en: "Shop by category" }, icon: FolderTree },
      { to: "/admin/season-picks", label: { ar: "مختارات الموسم", en: "Season picks" }, icon: Sparkles },
      { to: "/admin/storefront", label: { ar: "بانرات المتجر", en: "Storefront banners" }, icon: Layout },
      
      { to: "/admin/cms-pages", label: { ar: "محرر الصفحات", en: "Page builder" }, icon: Sparkles },
      { to: "/admin/featured-categories", label: { ar: "أقسام مميزة", en: "Featured categories" }, icon: FolderTree },
      { to: "/admin/popular-picks", label: { ar: "الأكثر رواجاً", en: "Popular picks" }, icon: Activity },
      { to: "/admin/announcements", label: { ar: "الشريط الإعلاني", en: "Announcement bar" }, icon: Bell },
      { to: "/admin/content", label: { ar: "صفحات", en: "Pages" }, icon: FileText },
      { to: "/admin/faq", label: { ar: "الأسئلة الشائعة", en: "FAQ" }, icon: LifeBuoy },
      { to: "/admin/themes", label: { ar: "الثيمات", en: "Themes" }, icon: Layout },
    ],
  },
  {
    label: { ar: "العمليات", en: "Operations" },
    items: [
      { to: "/admin/shipping", label: { ar: "الشحن", en: "Shipping" }, icon: Truck },
      { to: "/admin/shipping-carriers", label: { ar: "شركات الشحن", en: "Carriers" }, icon: Truck },
      { to: "/admin/shipping-zones", label: { ar: "مناطق الشحن", en: "Zones" }, icon: Globe },
      { to: "/admin/shipping-rates", label: { ar: "أسعار الشحن", en: "Rates" }, icon: FileSpreadsheet },
      { to: "/admin/integrations", label: { ar: "التكاملات", en: "Integrations" }, icon: Plug },
      { to: "/admin/webhooks", label: { ar: "Webhooks", en: "Webhooks" }, icon: Webhook },
      { to: "/admin/incoming-webhooks", label: { ar: "Webhooks الواردة", en: "Incoming webhooks" }, icon: Webhook },
      { to: "/admin/webhooks-deliveries", label: { ar: "تسليمات Webhooks", en: "Webhook deliveries" }, icon: ScrollText },
      { to: "/admin/webhooks-health", label: { ar: "صحة Webhooks", en: "Webhooks health" }, icon: Activity },
      { to: "/admin/oto", label: { ar: "OTO", en: "OTO" }, icon: Truck },
      { to: "/admin/reports", label: { ar: "التقارير", en: "Reports" }, icon: FileSpreadsheet },
      { to: "/admin/site-analytics", label: { ar: "تحليلات الموقع", en: "Site analytics" }, icon: Eye },
      { to: "/admin/performance", label: { ar: "الأداء", en: "Performance" }, icon: Activity },
    ],
  },
  {
    label: { ar: "النظام", en: "System" },
    items: [
      { to: "/admin/settings", label: { ar: "الإعدادات", en: "Settings" }, icon: Settings },
      { to: "/admin/security", label: { ar: "الأمان", en: "Security" }, icon: Shield },
      { to: "/admin/permissions", label: { ar: "الأدوار والصلاحيات", en: "Roles & Permissions" }, icon: Shield },
      { to: "/admin/audit", label: { ar: "سجل العمليات", en: "Audit log" }, icon: ScrollText },
      { to: "/admin/audit-logins", label: { ar: "محاولات الدخول", en: "Login attempts" }, icon: Shield },
      { to: "/admin/errors", label: { ar: "الأخطاء", en: "Errors" }, icon: AlertCircle },
      { to: "/admin/states", label: { ar: "الحالات", en: "States" }, icon: Activity },
      { to: "/admin/privacy", label: { ar: "الخصوصية", en: "Privacy" }, icon: Shield },
      { to: "/admin/help", label: { ar: "المساعدة", en: "Help" }, icon: LifeBuoy },
    ],
  },
];
