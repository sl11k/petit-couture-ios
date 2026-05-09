import { useState, type ReactNode } from "react";
import { useAuth } from "@/state/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, LogOut, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "../sidebar/AdminSidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { canAccessAdmin, loading } = useUserRole();
  const { lang, setLang } = useLanguage();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm">{ar ? "يجب تسجيل الدخول" : "Please sign in"}</p>
        <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          {ar ? "تسجيل الدخول" : "Sign in"}
        </Link>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{ar ? "ليست لديك صلاحية" : "Access denied"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1.5 hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(ar ? "en" : "ar")}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <Globe className="h-3 w-3" /> {ar ? "EN" : "AR"}
            </button>
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <LogOut className="h-3 w-3" /> {ar ? "خروج" : "Sign out"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
