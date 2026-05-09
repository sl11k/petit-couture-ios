import {
  LayoutDashboard, ShoppingBag, Package, FolderTree, Boxes, Users, ShoppingCart,
  CreditCard, Truck, Undo2, Ticket, Megaphone, FileText, Layout, BarChart3, Bell,
  MessageSquare, Headphones, Plug, Settings, Shield, ScrollText, LifeBuoy, Search,
  Plus, AlertCircle, FileSpreadsheet, Activity, Globe, Eye, Mail, Webhook,
  type LucideIcon,
} from "lucide-react";
import type { Bilingual } from "../types";

export type NavItem = {
  to: string;
  label: Bilingual;
  icon: LucideIcon;
  /** Set to true if not yet rebuilt */
  comingSoon?: boolean;
};

export type NavGroup = {
  label: Bilingual;
  items: NavItem[];
};

/**
 * The `comingSoon` flag marks pages that are not yet rebuilt in Phase 1.
 * Once a page is rebuilt, just remove the flag — the link becomes active.
 */
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
      { to: "/admin/coupons", label: { ar: "الكوبونات", en: "Coupons" }, icon: Ticket },
    ],
  },
  {
    label: { ar: "العملاء", en: "Customers" },
    items: [
      { to: "/admin/customers", label: { ar: "العملاء", en: "Customers" }, icon: Users },
      { to: "/admin/users", label: { ar: "المستخدمون", en: "Users" }, icon: Users },
      { to: "/admin/messages", label: { ar: "الرسائل", en: "Messages" }, icon: MessageSquare },
      { to: "/admin/notifications", label: { ar: "الإشعارات", en: "Notifications" }, icon: Bell },
      { to: "/admin/support", label: { ar: "الدعم", en: "Support" }, icon: Headphones },
    ],
  },
  {
    label: { ar: "التسويق", en: "Marketing" },
    items: [
      { to: "/admin/campaigns", label: { ar: "الحملات", en: "Campaigns" }, icon: Megaphone },
      { to: "/admin/landing-pages", label: { ar: "صفحات الهبوط", en: "Landing pages" }, icon: Globe },
      { to: "/admin/conversion", label: { ar: "التحويل", en: "Conversion" }, icon: Activity },
      { to: "/admin/search", label: { ar: "البحث", en: "Search" }, icon: Search },
    ],
  },
  {
    label: { ar: "المحتوى", en: "Content" },
    items: [
      { to: "/admin/storefront", label: { ar: "المتجر", en: "Storefront" }, icon: Layout },
      { to: "/admin/home-builder", label: { ar: "محرر الرئيسية", en: "Home builder" }, icon: Layout },
      { to: "/admin/content", label: { ar: "صفحات", en: "Pages" }, icon: FileText },
    ],
  },
  {
    label: { ar: "العمليات", en: "Operations" },
    items: [
      { to: "/admin/shipping", label: { ar: "الشحن", en: "Shipping" }, icon: Truck },
      { to: "/admin/integrations", label: { ar: "التكاملات", en: "Integrations" }, icon: Plug },
      { to: "/admin/webhooks", label: { ar: "Webhooks", en: "Webhooks" }, icon: Webhook },
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
      { to: "/admin/audit", label: { ar: "سجل العمليات", en: "Audit log" }, icon: ScrollText },
      { to: "/admin/audit-logins", label: { ar: "محاولات الدخول", en: "Login attempts" }, icon: Shield },
      { to: "/admin/errors", label: { ar: "الأخطاء", en: "Errors" }, icon: AlertCircle },
      { to: "/admin/states", label: { ar: "الحالات", en: "States" }, icon: Activity },
      { to: "/admin/privacy", label: { ar: "الخصوصية", en: "Privacy" }, icon: Shield },
      { to: "/admin/help", label: { ar: "المساعدة", en: "Help" }, icon: LifeBuoy },
    ],
  },
];
