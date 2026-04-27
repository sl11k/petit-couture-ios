import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const NAV = [
  { to: "/admin", label: "الرئيسية", exact: true },
  { to: "/admin/orders", label: "الطلبات" },
  { to: "/admin/products", label: "المنتجات" },
  { to: "/admin/customers", label: "العملاء" },
  { to: "/admin/analytics", label: "التحليلات" },
  { to: "/admin/create-order", label: "إنشاء طلب" },
  { to: "/admin/settings", label: "الإعدادات" },
];

export function AdminShell({ children }: { children?: ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const { isStaff, loading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  if (!user) return null;

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">غير مصرح</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          هذه الصفحة للمسؤولين فقط. حسابك: {user.email}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          لتفعيل صلاحية المسؤول، تحتاج إضافة دور admin في قاعدة البيانات.
        </p>
        <Link to="/" className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          العودة للمتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <div className="mb-8 px-2">
          <h2 className="text-lg font-semibold text-foreground">لوحة التحكم</h2>
          <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="mt-4 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          تسجيل الخروج
        </button>
      </aside>
      <div className="flex w-full flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <h2 className="text-base font-semibold">الإدارة</h2>
          <Link to="/" className="text-xs text-muted-foreground">المتجر</Link>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 lg:hidden">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
