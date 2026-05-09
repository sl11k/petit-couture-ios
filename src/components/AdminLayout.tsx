import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
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
import { useRef } from "react";
import { ADMIN_AR_TO_EN } from "@/i18n/adminDict";

/**
 * Runtime DOM translation overlay for the admin area.
 * When `enabled`, walks all text nodes inside its subtree and replaces any
 * text whose trimmed value matches a key in ADMIN_AR_TO_EN. Uses a
 * MutationObserver so dynamically rendered content is also translated.
 *
 * Skips: <script>, <style>, <input>, <textarea>, elements with [data-no-translate]
 * or [contenteditable]. Does NOT mutate input values.
 */
function AdminTranslateScope({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;

    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA", "SVG"]);

    function shouldSkip(node: Node): boolean {
      let el: Node | null = node;
      while (el && el !== root) {
        if (el.nodeType === 1) {
          const e = el as HTMLElement;
          if (SKIP_TAGS.has(e.tagName)) return true;
          if (e.hasAttribute?.("data-no-translate")) return true;
          if (e.getAttribute?.("contenteditable") === "true") return true;
        }
        el = (el as Node).parentNode;
      }
      return false;
    }

    function translateText(raw: string): string | null {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const en = ADMIN_AR_TO_EN[trimmed];
      if (!en || en === trimmed) return null;
      // Preserve surrounding whitespace.
      const lead = raw.match(/^\s*/)?.[0] ?? "";
      const tail = raw.match(/\s*$/)?.[0] ?? "";
      return lead + en + tail;
    }

    function walk(node: Node) {
      if (shouldSkip(node)) return;
      if (node.nodeType === 3) {
        const t = (node as Text).nodeValue ?? "";
        const next = translateText(t);
        if (next !== null) (node as Text).nodeValue = next;
        return;
      }
      // Also translate placeholder + title + aria-label on element nodes.
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        for (const attr of ["placeholder", "title", "aria-label"]) {
          const v = el.getAttribute?.(attr);
          if (v) {
            const next = translateText(v);
            if (next !== null) el.setAttribute(attr, next);
          }
        }
        node.childNodes.forEach(walk);
      }
    }

    walk(root);

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.nodeType === 3) {
          if (!shouldSkip(m.target)) {
            const t = (m.target as Text).nodeValue ?? "";
            const next = translateText(t);
            if (next !== null) (m.target as Text).nodeValue = next;
          }
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => walk(n));
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          const el = m.target as HTMLElement;
          const name = m.attributeName;
          if (name && ["placeholder", "title", "aria-label"].includes(name)) {
            const v = el.getAttribute(name);
            if (v) {
              const next = translateText(v);
              if (next !== null) el.setAttribute(name, next);
            }
          }
        }
      }
    });
    obs.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });
    return () => obs.disconnect();
  }, [enabled]);

  return <div ref={ref} className="contents">{children}</div>;
}

type NavItem = {
  to: string;
  labelAr: string;
  labelEn: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavGroup = {
  labelAr: string;
  labelEn: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    labelAr: "نظرة عامة",
    labelEn: "Overview",
    items: [
      { to: "/admin", labelAr: "الرئيسية", labelEn: "Home", icon: LayoutDashboard, exact: true },
      { to: "/admin/reports", labelAr: "التقارير الشاملة", labelEn: "Reports", icon: BarChart3 },
      { to: "/admin/site-analytics", labelAr: "تحليلات الموقع", labelEn: "Site analytics", icon: BarChart3 },
      { to: "/admin/analytics", labelAr: "التحليلات", labelEn: "Analytics", icon: BarChart3 },
    ],
  },
  {
    labelAr: "المبيعات",
    labelEn: "Sales",
    items: [
      { to: "/admin/orders", labelAr: "الطلبات", labelEn: "Orders", icon: ShoppingBag },
      { to: "/admin/abandoned", labelAr: "السلات المتروكة", labelEn: "Abandoned carts", icon: ShoppingCart },
      { to: "/admin/incomplete", labelAr: "الطلبات غير المكتملة", labelEn: "Incomplete orders", icon: AlertCircle },
      { to: "/admin/create-order", labelAr: "إنشاء طلب", labelEn: "Create order", icon: Plus },
      { to: "/admin/payments", labelAr: "المدفوعات", labelEn: "Payments", icon: CreditCard },
      { to: "/admin/shipping", labelAr: "الشحن", labelEn: "Shipping", icon: Truck },
      { to: "/admin/returns", labelAr: "المرتجعات", labelEn: "Returns", icon: Undo2 },
    ],
  },
  {
    labelAr: "الكتالوج",
    labelEn: "Catalog",
    items: [
      { to: "/admin/products", labelAr: "المنتجات", labelEn: "Products", icon: Package },
      { to: "/admin/categories", labelAr: "الأقسام", labelEn: "Categories", icon: FolderTree },
      { to: "/admin/inventory", labelAr: "المخزون", labelEn: "Inventory", icon: Boxes },
    ],
  },
  {
    labelAr: "العملاء والتسويق",
    labelEn: "Customers & Marketing",
    items: [
      { to: "/admin/customers", labelAr: "العملاء", labelEn: "Customers", icon: Users },
      { to: "/admin/coupons", labelAr: "الكوبونات", labelEn: "Coupons", icon: Ticket },
      { to: "/admin/invoices", labelAr: "الفواتير والضرائب", labelEn: "Invoices & tax", icon: FileText },
      { to: "/admin/campaigns", labelAr: "العروض والحملات", labelEn: "Campaigns", icon: Megaphone },
    ],
  },
  {
    labelAr: "المحتوى",
    labelEn: "Content",
    items: [
      { to: "/admin/content", labelAr: "المحتوى", labelEn: "Content", icon: FileText },
      { to: "/admin/home-builder", labelAr: "بناء الصفحة الرئيسية", labelEn: "Home builder", icon: Layout },
      { to: "/admin/storefront", labelAr: "إدارة الواجهة", labelEn: "Storefront" , icon: Layout },
      { to: "/admin/landing-pages", labelAr: "الصفحات والمجموعات", labelEn: "Pages & collections", icon: Layout },
    ],
  },
  {
    labelAr: "الاتصالات",
    labelEn: "Communications",
    items: [
      { to: "/admin/notifications", labelAr: "الإشعارات", labelEn: "Notifications", icon: Bell },
      { to: "/admin/messages", labelAr: "الرسائل", labelEn: "Messages", icon: MessageSquare },
      { to: "/admin/support", labelAr: "خدمة العملاء", labelEn: "Customer support", icon: HeadphonesIcon },
    ],
  },
  {
    labelAr: "النظام",
    labelEn: "System",
    items: [
      { to: "/admin/users", labelAr: "المستخدمون والصلاحيات", labelEn: "Users & roles", icon: Shield },
      { to: "/admin/security", labelAr: "مركز الأمان", labelEn: "Security center", icon: Shield },
      { to: "/admin/privacy", labelAr: "إدارة الخصوصية", labelEn: "Privacy management", icon: Shield },
      { to: "/admin/integrations", labelAr: "التكاملات", labelEn: "Integrations", icon: Plug },
      { to: "/admin/webhooks", labelAr: "Webhooks وAPI", labelEn: "Webhooks & API", icon: Plug },
      { to: "/admin/audit", labelAr: "سجل العمليات", labelEn: "Audit log", icon: ScrollText },
      { to: "/admin/audit-logins", labelAr: "محاولات الدخول الفاشلة", labelEn: "Failed login attempts", icon: ScrollText },
      { to: "/admin/conversion", labelAr: "تحسين التحويل", labelEn: "Conversion", icon: ScrollText },
      { to: "/admin/search", labelAr: "تقارير البحث", labelEn: "Search reports", icon: ScrollText },
      { to: "/admin/performance", labelAr: "مراقبة الأداء", labelEn: "Performance", icon: ScrollText },
      { to: "/admin/errors", labelAr: "سجل الأخطاء", labelEn: "Error log", icon: AlertCircle },
      { to: "/admin/states", labelAr: "دليل حالات الشاشات", labelEn: "Screen states", icon: Layout },
      { to: "/admin/settings", labelAr: "الإعدادات", labelEn: "Settings", icon: Settings },
      { to: "/admin/help", labelAr: "الدعم الفني", labelEn: "Technical support", icon: LifeBuoy },
    ],
  },
];

function flatNav() {
  return NAV_GROUPS.flatMap((g) => g.items);
}

export function AdminShell({ children }: { children?: ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const { canAccessAdmin, loading, isAdmin, isManager, isStaff, isViewer } = useUserRole();
  const { lang, isRTL, toggle } = useLanguage();
  const ar = lang === "ar";
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

  // Find current page label (used by SEO + topbar title).
  const currentPage = useMemo(
    () =>
      flatNav().find((i) =>
        i.exact ? location.pathname === i.to : location.pathname === i.to || location.pathname.startsWith(i.to + "/"),
      ),
    [location.pathname],
  );

  // Dynamic <title> + noindex meta for the entire admin surface (SEO).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const pageLabel = currentPage ? (ar ? currentPage.labelAr : currentPage.labelEn) : (ar ? "لوحة الإدارة" : "Admin");
    const prevTitle = document.title;
    document.title = `${pageLabel} · Le Petit Paradis ${ar ? "إدارة" : "Admin"}`;

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-admin]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      robots.setAttribute("data-admin", "true");
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";

    return () => {
      document.title = prevTitle;
      robots?.remove();
    };
  }, [currentPage, ar]);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  const itemLabel = (i: NavItem) => (ar ? i.labelAr : i.labelEn);
  const groupLabel = (g: NavGroup) => (ar ? g.labelAr : g.labelEn);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return NAV_GROUPS;
    const q = search.trim().toLowerCase();
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => itemLabel(i).toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, ar]);

  const roleBadge = ar
    ? (isAdmin ? "مسؤول" : isManager ? "مدير" : isStaff ? "موظف" : isViewer ? "مشاهد" : "")
    : (isAdmin ? "Admin" : isManager ? "Manager" : isStaff ? "Staff" : isViewer ? "Viewer" : "");

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {ar ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }
  if (!user) return null;

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{ar ? "غير مصرح" : "Unauthorized"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ar ? "هذه الصفحة لفريق الإدارة فقط." : "This page is for the admin team only."}</p>
        <p className="mt-1 text-xs text-muted-foreground">{ar ? "حسابك" : "Your account"}: {user.email}</p>
        <Link to="/" className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          {ar ? "العودة للمتجر" : "Back to store"}
        </Link>
      </div>
    );
  }

  const Sidebar = (
    <aside className={`flex h-full w-72 shrink-0 flex-col ${isRTL ? "border-l" : "border-r"} border-border bg-card`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Le Petit Paradis · {ar ? "لوحة الإدارة" : "Admin"}</h2>
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
          <Search className={`pointer-events-none absolute ${isRTL ? "right-2" : "left-2"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ar ? "ابحث في القوائم..." : "Search menus..."}
            className={`w-full rounded-md border border-border bg-background py-1.5 ${isRTL ? "pr-7 pl-2" : "pl-7 pr-2"} text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary`}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {filteredGroups.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">{ar ? "لا توجد نتائج" : "No results"}</p>
        )}
        {filteredGroups.map((group) => (
          <div key={group.labelEn} className="mb-4">
            <div className="sticky top-0 z-10 -mx-2 mb-1 bg-card/95 px-5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 backdrop-blur">
              {groupLabel(group)}
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
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 transition-transform ${active ? "" : "group-hover:scale-110"}`} />
                      <span className="flex-1 truncate">{itemLabel(item)}</span>
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
            title={ar ? "الوضع الداكن" : "Dark mode"}
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {dark ? (ar ? "فاتح" : "Light") : (ar ? "داكن" : "Dark")}
          </button>
          <Link
            to="/"
            className="flex flex-1 items-center justify-center rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {ar ? "المتجر" : "Store"}
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
          {ar ? "تسجيل الخروج" : "Sign out"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-muted/20" dir={isRTL ? "rtl" : "ltr"}>
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
          <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 h-full`}>{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md border border-border p-1.5 text-foreground lg:hidden"
            aria-label={ar ? "فتح القائمة" : "Open menu"}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {currentPage ? itemLabel(currentPage) : (ar ? "لوحة الإدارة" : "Admin dashboard")}
            </h1>
          </div>
          <button
            type="button"
            onClick={toggle}
            data-no-translate
            className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium tracking-wider text-foreground hover:bg-muted"
            title={ar ? "Switch to English" : "التبديل للعربية"}
            aria-label={ar ? "Switch to English" : "التبديل للعربية"}
          >
            {ar ? "EN" : "ع"}
          </button>
          <Link
            to="/admin/create-order"
            className="hidden items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 sm:flex"
          >
            <Plus className="h-3.5 w-3.5" /> {ar ? "طلب جديد" : "New order"}
          </Link>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md border border-border p-1.5 text-foreground lg:hidden"
              aria-label={ar ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-x-auto p-4 lg:p-6">
          <AdminTranslateScope enabled={lang === "en"}>
            {children ?? <Outlet />}
          </AdminTranslateScope>
        </main>
      </div>
    </div>
  );
}
