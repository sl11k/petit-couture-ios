import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/AuthContext";

export type AppRole = "admin" | "manager" | "staff" | "viewer" | "customer";

export function useUserRole() {
  const { user, ready } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setRoles((data ?? []).map((r) => r.role as AppRole));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, ready]);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isStaff = roles.includes("staff");
  const isViewer = roles.includes("viewer");

  // canAccessAdmin: any back-office role
  const canAccessAdmin = isAdmin || isManager || isStaff || isViewer;
  // canManage: write access (excludes viewer + staff for sensitive ops)
  const canManage = isAdmin || isManager;
  // canEditOrders: staff + above
  const canEditOrders = isAdmin || isManager || isStaff;

  return {
    roles,
    loading,
    isAdmin,
    isManager,
    isStaff: isStaff || isAdmin,
    isViewer,
    canAccessAdmin,
    canManage,
    canEditOrders,
  };
}
