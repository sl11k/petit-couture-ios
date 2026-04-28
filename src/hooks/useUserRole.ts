import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/AuthContext";

export type AppRole =
  | "super_admin"
  | "admin"
  | "store_manager"
  | "orders_manager"
  | "support"
  | "inventory_manager"
  | "marketing_manager"
  | "finance_manager"
  | "content_manager"
  | "developer"
  | "manager"
  | "staff"
  | "viewer"
  | "customer";

const ADMIN_ROLES: AppRole[] = [
  "super_admin","admin","store_manager","orders_manager","support",
  "inventory_manager","marketing_manager","finance_manager","content_manager",
  "developer","manager","staff","viewer",
];

export function useUserRole() {
  const { user, ready } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) { setRoles([]); setPermissions(new Set()); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const userRoles = (rolesData ?? []).map((r) => r.role as AppRole);
      let perms = new Set<string>();
      if (userRoles.length > 0) {
        const { data: permsData } = await supabase.from("role_permissions").select("permission").in("role", userRoles as any);
        perms = new Set((permsData ?? []).map((p: any) => p.permission as string));
      }
      if (cancelled) return;
      setRoles(userRoles);
      setPermissions(perms);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, ready]);

  const isSuperAdmin = roles.includes("super_admin") || roles.includes("admin");
  const isManager = roles.includes("manager") || roles.includes("store_manager");
  const isStaff = roles.includes("staff");
  const isViewer = roles.includes("viewer");
  const canAccessAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  const canManage = isSuperAdmin || isManager;

  const can = (permission: string): boolean => {
    if (isSuperAdmin) return true;
    if (permissions.has("*")) return true;
    return permissions.has(permission);
  };

  return {
    roles, permissions, loading,
    isSuperAdmin,
    isAdmin: isSuperAdmin, // backward compat
    isManager, isStaff: isStaff || isSuperAdmin, isViewer,
    canAccessAdmin, canManage,
    canEditOrders: can("orders.edit"),
    can,
  };
}
