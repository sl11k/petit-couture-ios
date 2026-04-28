import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Boxes,
  Users,
  ShoppingCart,
  CreditCard,
  Truck,
  Undo2,
  Ticket,
  Megaphone,
  FileText,
  Layout,
  BarChart3,
  Bell,
  MessageSquare,
  HeadphonesIcon,
  Plug,
  Settings,
  Shield,
  ScrollText,
  LifeBuoy,
  Menu,
  X,
  Search,
  Moon,
  Sun,
  LogOut,
  Plus,
  AlertCircle,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: "soon";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "نظرة عامة",
    items: [
      { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
      { to: "/admin/reports", label: "التقارير الشاملة", icon: BarChart3 },
      { to: "/admin/analytics", label: "التحليلات", icon: BarChart3 },
    ],
  },
  {
    label: "المبيعات",
    items: [
      { to: "/admin/orders", label: "الطلبات", icon: ShoppingBag },
      { to: "/admin/abandoned", label: "السلات المتروكة", icon: ShoppingCart },
      { to: "/admin/incomplete", label: "الطلبات غير المكتملة", icon: AlertCircle },
      { to: "/admin/create-order", label: "إنشاء طلب", icon: Plus },
      { to: "/admin/payments", label: "المدفوعات", icon: CreditCard },
      { to: "/admin/shipping", label: "الشحن", icon: Truck },
      { to: "/admin/returns", label: "المرتجعات", icon: Undo2, badge: "soon" },
    ],
  },
  {
    label: "الكتالوج",
    items: [
      { to: "/admin/products", label: "المنتجات", icon: Package },
      { to: "/admin/categories", label: "الأقسام", icon: FolderTree },
      { to: "/admin/inventory", label: "المخزون", icon: Boxes },
    ],
  },
  {
    label: "العملاء والتسويق",
    items: [
      { to: "/admin/customers", label: "العملاء", icon: Users },
      { to: "/admin/coupons", label: "الكوبونات", icon: Ticket },
      { to: "/admin/campaigns", label: "العروض والحملات", icon: Megaphone, badge: "soon" },
    ],
  },
  {
    label: "المحتوى",
    items: [
      { to: "/admin/content", label: "المحتوى", icon: FileText, badge: "soon" },
      { to: "/admin/storefront", label: "واجهات الموقع", icon: Layout, badge: "soon" },
    ],
  },
  {
    label: "الاتصالات",
    items: [
      { to: "/admin/notifications", label: "الإشعارات", icon: Bell },
      { to: "/admin/messages", label: "الرسائل", icon: MessageSquare },
      { to: "/admin/support", label: "خدمة العملاء", icon: HeadphonesIcon },
    ],
  },
  {
    label: "النظام",
    items: [
      { to: "/admin/users", label: "المستخدمون والصلاحيات", icon: Shield },
      { to: "/admin/integrations", label: "التكاملات", icon: Plug, badge: "soon" },
      { to: "/admin/audit", label: "سجل العمليات", icon: ScrollText },
      { to: "/admin/settings", label: "الإعدادات", icon: Settings },
      { to: "/admin/help", label: "الدعم الفني", icon: LifeBuoy, badge: "soon" },
    ],
  },
];

function flatNav() {
  return NAV_GROUPS.flatMap((g) => g.items);
}

export function AdminShell({ children }: { children?: ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const { canAccessAdmin, loading, isAdmin, isManager, isStaff, isViewer } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return NAV_GROUPS;
    const q = search.trim().toLowerCase();
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  const roleBadge = isAdmin ? "مسؤول" : isManager ? "مدير" : isStaff ? "موظف" : isViewer ? "مشاهد" : "";

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }
  if (!user) return null;

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">غير مصرح</h1>
        <p className="mt-2 text-sm text-muted-foreground">هذه الصفحة لفريق الإدارة فقط.</p>
        <p className="mt-1 text-xs text-muted-foreground">حسابك: {user.email}</p>
        <Link to="/" className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          العودة للمتجر
        </Link>
      </div>
    );
  }

  const Sidebar = (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Maisonnet · لوحة الإدارة</h2>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={user.email ?? ""}>
            {user.email}
          </p>
        </div>
        {roleBadge && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {roleBadge}
          </span>
        )}
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في القوائم..."
            className="w-full rounded-md border border-border bg-background py-1.5 pr-7 pl-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {filteredGroups.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">لا توجد نتائج</p>
        )}
        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.exact
                  ? location.pathname === item.to
                  : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge === "soon" && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          قريباً
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={toggleDark}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            title="الوضع الداكن"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {dark ? "فاتح" : "داكن"}
          </button>
          <Link
            to="/"
            className="flex flex-1 items-center justify-center rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            المتجر
          </Link>
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );

  // Find current page label
  const currentPage = flatNav().find((i) =>
    i.exact ? location.pathname === i.to : location.pathname === i.to || location.pathname.startsWith(i.to + "/"),
  );

  return (
    <div className="flex min-h-screen bg-muted/20" dir="rtl">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen">{Sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-0 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md border border-border p-1.5 text-foreground lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {currentPage?.label ?? "لوحة الإدارة"}
            </h1>
          </div>
          <Link
            to="/admin/create-order"
            className="hidden items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 sm:flex"
          >
            <Plus className="h-3.5 w-3.5" /> طلب جديد
          </Link>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-border p-1.5 text-foreground lg:hidden"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-x-auto p-4 lg:p-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
