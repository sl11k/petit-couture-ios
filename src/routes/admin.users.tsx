import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Search } from "lucide-react";

type UserRow = { user_id: string; email: string | null; created_at: string; roles: string[] };

const ALL_ROLES: { value: string; ar: string; en: string }[] = [
  { value: "super_admin", ar: "مدير عام", en: "Super Admin" },
  { value: "admin", ar: "مدير", en: "Admin" },
  { value: "manager", ar: "مشرف", en: "Manager" },
  { value: "store_manager", ar: "مشرف متجر", en: "Store Manager" },
  { value: "orders_manager", ar: "مشرف طلبات", en: "Orders Manager" },
  { value: "inventory_manager", ar: "مشرف مخزون", en: "Inventory Manager" },
  { value: "marketing_manager", ar: "مشرف تسويق", en: "Marketing Manager" },
  { value: "finance_manager", ar: "مشرف مالي", en: "Finance Manager" },
  { value: "content_manager", ar: "مشرف محتوى", en: "Content Manager" },
  { value: "support", ar: "دعم", en: "Support" },
  { value: "staff", ar: "موظف", en: "Staff" },
  { value: "viewer", ar: "مشاهد", en: "Viewer" },
  { value: "developer", ar: "مطور", en: "Developer" },
  { value: "customer", ar: "عميل", en: "Customer" },
];

function UsersPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_all_users_with_roles");
    if (error) toast.error(error.message);
    setRows((data ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => (r.email ?? "").toLowerCase().includes(q) || r.user_id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setSelectedRoles(new Set(row.roles));
  };

  const toggleRole = (v: string) => {
    setSelectedRoles((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_user_roles", {
      _user_id: editing.user_id,
      _roles: Array.from(selectedRoles),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? "تم حفظ الأدوار" : "Roles updated");
    setEditing(null);
    void load();
  };

  return (
    <div>
      <PageHeader
        title={{ ar: "المستخدمون والصلاحيات", en: "Users & Roles" }}
        description={{ ar: `${rows.length} مستخدم`, en: `${rows.length} users` }}
      />

      <div className="mb-3 relative max-w-sm">
        <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ar ? "بحث بالإيميل أو المعرّف..." : "Search by email or ID..."}
          className="ps-8 h-9 text-xs"
        />
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-start">
              <th className="px-3 py-2 text-start font-medium">{ar ? "البريد الإلكتروني" : "Email"}</th>
              <th className="px-3 py-2 text-start font-medium">{ar ? "الأدوار" : "Roles"}</th>
              <th className="px-3 py-2 text-start font-medium hidden md:table-cell">{ar ? "تاريخ الإنشاء" : "Created"}</th>
              <th className="px-3 py-2 text-start font-medium hidden lg:table-cell">{ar ? "المعرّف" : "ID"}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{ar ? "جارٍ التحميل..." : "Loading..."}</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{ar ? "لا يوجد مستخدمون" : "No users"}</td></tr>
            )}
            {!loading && filtered.map((r) => (
              <tr key={r.user_id} className="border-t border-border">
                <td className="px-3 py-2">{r.email ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.roles.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">{ar ? "بدون دور" : "No role"}</Badge>
                    ) : r.roles.map((rl) => {
                      const meta = ALL_ROLES.find((x) => x.value === rl);
                      return (
                        <Badge key={rl} variant="secondary" className="text-[10px]">
                          {meta ? (ar ? meta.ar : meta.en) : rl}
                        </Badge>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
                </td>
                <td className="px-3 py-2 hidden lg:table-cell font-mono text-[10px] text-muted-foreground">
                  {r.user_id.slice(0, 8)}…
                </td>
                <td className="px-3 py-2 text-end">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="h-3 w-3 me-1" />
                    {ar ? "تعديل الأدوار" : "Edit roles"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعديل أدوار المستخدم" : "Edit user roles"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {editing.email ?? editing.user_id}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {ALL_ROLES.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedRoles.has(role.value)}
                      onCheckedChange={() => toggleRole(role.value)}
                    />
                    <span className="text-xs">{ar ? role.ar : role.en}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});
