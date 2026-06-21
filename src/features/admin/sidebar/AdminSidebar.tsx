import { Link, useRouterState } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageContext";
import { ADMIN_NAV } from "./nav.config";
import { cn } from "@/lib/utils";
import { ChevronRight, X } from "lucide-react";

export function AdminSidebar({
  open,
  onClose,
  collapsed = false,
}: {
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname === to || pathname.startsWith(to + "/");

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}

      <aside
        data-tour="sidebar"
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col border-border bg-card transition-[width,transform] lg:static lg:translate-x-0",
          ar ? "right-0 border-l" : "left-0 border-r",
          open ? "translate-x-0" : ar ? "translate-x-full" : "-translate-x-full",
          "lg:translate-x-0",
          collapsed ? "w-64 lg:w-14" : "w-64",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link to="/admin" className={cn("text-sm font-semibold", collapsed && "lg:hidden")}>
            {ar ? "لوحة الإدارة" : "Admin"}
          </Link>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted lg:hidden" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          {ADMIN_NAV.map((group) => (
            <div key={group.label.en} className="mb-4">
              <div className={cn(
                "mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                collapsed && "lg:hidden",
              )}>
                {ar ? group.label.ar : group.label.en}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  const labelText = ar ? item.label.ar : item.label.en;
                  const content = (
                    <>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>{labelText}</span>
                      {item.comingSoon && (
                        <span className={cn(
                          "rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground",
                          collapsed && "lg:hidden",
                        )}>
                          {ar ? "قريباً" : "Soon"}
                        </span>
                      )}
                      {active && !collapsed && <ChevronRight className={cn("h-3 w-3", ar && "rotate-180")} />}
                    </>
                  );
                  const className = cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    collapsed && "lg:justify-center lg:px-2",
                    active
                      ? "bg-primary text-primary-foreground"
                      : item.comingSoon
                        ? "cursor-not-allowed text-muted-foreground/60"
                        : "text-foreground hover:bg-muted",
                  );
                  return (
                    <li key={item.to} data-tour={`nav:${item.to}`}>
                      {item.comingSoon ? (
                        <div className={className} title={collapsed ? labelText : (ar ? "قيد التطوير" : "Coming soon")}>
                          {content}
                        </div>
                      ) : (
                        <Link to={item.to} className={className} onClick={onClose} title={collapsed ? labelText : undefined}>
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
