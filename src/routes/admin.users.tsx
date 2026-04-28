import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, PERMISSION_GROUPS } from "@/lib/audit";
import { logAudit } from "@/lib/audit";
import { Shield, X, Settings2 } from "lucide-react";

export const Route = createFileRoute("/admin/users")({ component: UsersAdmin });

const ASSIGNABLE: AppRole[] = [
  "super_admin","store_manager","orders_manager","support",
  "inventory_manager","marketing_manager","finance_manager","content_manager",
  "developer","viewer",
];

type Row = { user_id: string; email: string | null; full_name: string | null; roles: AppRole[]; created_at: string };

function UsersAdmin() {
  const { isSuperAdmin } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, email, full_name, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map<string, AppRole[]>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role); map.set(r.user_id, arr);
    });
    setRows((profilesRes.data ?? []).map((p: any) => ({
      user_id: p.user_id, email: p.email, full_name: p.full_name, created_at: p.created_at,
      roles: map.get(p.user_id) ?? ["customer"],
    })));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function toggleRole(userId: string, role: AppRole, has: boolean, email: string | null) {
    if (!isSuperAdmin) return alert("هذه العملية للمسؤول الأعلى فقط");
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      await logAudit({ action: "user.role_revoke", entity: "user", entity_id: userId, metadata: { role, email } });
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role });
      await logAudit({ action: "user.role_grant", entity: "user", entity_id: userId, metadata: { role, email } });
    }
    await load();
  }

  async function openRoleEditor(role: AppRole) {
    setEditingRole(role);
    const { data } = await supabase.from("role_permissions").select("permission").eq("role", role);
    setRolePerms(new Set((data ?? []).map((r: any) => r.permission)));
  }

  async function togglePerm(perm: string) {
    if (!editingRole) return;
    const has = rolePerms.has(perm);
    if (has) {
      await supabase.from("role_permissions").delete().eq("role", editingRole).eq("permission", perm);
      rolePerms.delete(perm);
    } else {
      await supabase.from("role_permissions").insert({ role: editingRole, permission: perm });
      rolePerms.add(perm);
    }
    setRolePerms(new Set(rolePerms));
    await logAudit({ action: has ? "permission.revoke" : "permission.grant", entity: "role", entity_id: editingRole, metadata: { permission: perm } });
  }

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.email?.toLowerCase().includes(q) || r.full_name?.toLowerCase().includes(q);
  }), [rows, search]);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">المستخدمون والأدوار والصلاحيات</h1>
          <p className="text-xs text-muted-foreground">{rows.length} مستخدم — نظام صلاحيات دقيق RBAC</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
      </div>

      {!isSuperAdmin && (
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-50/50 p-3 text-xs text-amber-800 dark:bg-amber-950/20">
          <Shield className="inline h-3.5 w-3.5" /> أنت تشاهد فقط — تعديل الأدوار والصلاحيات يتطلب <b>Super Admin</b>.
        </div>
      )}

      {/* Roles overview with edit-permissions button */}
      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        {ASSIGNABLE.map((r) => (
          <div key={r} className="flex items-start justify-between gap-2 rounded-lg border border-border/60 p-3">
            <div className="text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{ROLE_LABELS[r]}</span>
              <p className="mt-1 text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
            {isSuperAdmin && (
              <button onClick={() => openRoleEditor(r)} title="تعديل الصلاحيات"
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted">
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Users table */}
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
                        <span key={role} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{ROLE_LABELS[role]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {ASSIGNABLE.map((role) => {
                        const has = r.roles.includes(role);
                        return (
                          <button key={role} onClick={() => toggleRole(r.user_id, role, has, r.email)}
                            disabled={!isSuperAdmin}
                            className={`rounded-md border px-2 py-1 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              has ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
                            }`}>
                            {has ? "✓ " : "+ "}{ROLE_LABELS[role]}
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

      {/* Permission editor modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingRole(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">صلاحيات: {ROLE_LABELS[editingRole]}</h2>
                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[editingRole]}</p>
              </div>
              <button onClick={() => setEditingRole(null)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{group.label}</h3>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {group.perms.map((p) => {
                      const has = rolePerms.has(p.key) || rolePerms.has("*");
                      const wildcard = rolePerms.has("*");
                      return (
                        <label key={p.key} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${has ? "border-primary bg-primary/5" : "border-border"}`}>
                          <input type="checkbox" checked={has} disabled={wildcard}
                            onChange={() => togglePerm(p.key)} className="h-3.5 w-3.5" />
                          <span>{p.label}</span>
                          <span className="ms-auto font-mono text-[9px] text-muted-foreground">{p.key}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {rolePerms.has("*") && (
                <p className="rounded bg-primary/10 p-2 text-xs text-primary">هذا الدور يملك صلاحية شاملة (*) — لا يمكن تقييد صلاحيات فردية.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
