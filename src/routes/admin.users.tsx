import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { Shield, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: UsersAdmin,
});

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "مسؤول",
  manager: "مدير",
  staff: "موظف",
  viewer: "مشاهد",
  customer: "عميل",
};

const ROLE_DESC: Record<AppRole, string> = {
  admin: "كامل الصلاحيات + إدارة المستخدمين",
  manager: "إدارة كاملة عدا المستخدمين والإعدادات الحساسة",
  staff: "إدارة الطلبات والمنتجات",
  viewer: "قراءة فقط (تقارير ومتابعة)",
  customer: "عميل عادي",
};

const ASSIGNABLE: AppRole[] = ["admin", "manager", "staff", "viewer", "customer"];

type Row = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: AppRole[];
  created_at: string;
};

function UsersAdmin() {
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, email, full_name, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesMap = new Map<string, AppRole[]>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    const list: Row[] = (profilesRes.data ?? []).map((p: any) => ({
      user_id: p.user_id,
      email: p.email,
      full_name: p.full_name,
      created_at: p.created_at,
      roles: rolesMap.get(p.user_id) ?? ["customer"],
    }));
    setRows(list);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function toggleRole(userId: string, role: AppRole, has: boolean) {
    if (!isAdmin) return alert("هذه العملية للمسؤولين فقط");
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
    await load();
  }

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.email?.toLowerCase().includes(q) || r.full_name?.toLowerCase().includes(q);
  });

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المستخدمون والصلاحيات</h1>
          <p className="text-xs text-muted-foreground">{rows.length} مستخدم مسجل</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
      </div>

      {!isAdmin && (
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-50/50 p-3 text-xs text-amber-800 dark:bg-amber-950/20">
          <Shield className="inline h-3.5 w-3.5" /> أنت تشاهد فقط — تعديل الصلاحيات يتطلب دور <b>admin</b>.
        </div>
      )}

      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        {ASSIGNABLE.map((r) => (
          <div key={r} className="text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{ROLE_LABEL[r]}</span>
            <p className="mt-1 text-muted-foreground">{ROLE_DESC[r]}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">المستخدم</th>
                <th className="p-3">الأدوار الحالية</th>
                <th className="p-3">تغيير الأدوار</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id} className="border-b border-border/50 last:border-0 align-top">
                  <td className="p-3">
                    <div className="text-xs font-medium">{r.full_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.map((role) => (
                        <span key={role} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{ROLE_LABEL[role]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {ASSIGNABLE.map((role) => {
                        const has = r.roles.includes(role);
                        return (
                          <button key={role} onClick={() => toggleRole(r.user_id, role, has)}
                            disabled={!isAdmin}
                            className={`rounded-md border px-2 py-1 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              has ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
                            }`}>
                            {has ? "✓ " : "+ "}{ROLE_LABEL[role]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-xs text-muted-foreground">لا توجد نتائج</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
