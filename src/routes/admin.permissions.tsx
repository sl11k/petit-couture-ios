import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { toast } from "sonner";
import { Loader2, Save, Search, ShieldCheck, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin/permissions")({
  component: PermissionsPage,
});

// ---------- Catalog ----------
type Perm = { key: string; label: { ar: string; en: string } };
type Group = { id: string; label: { ar: string; en: string }; perms: Perm[] };

const CATALOG: Group[] = [
  {
    id: "orders",
    label: { ar: "الطلبات", en: "Orders" },
    perms: [
      { key: "orders.view", label: { ar: "عرض الطلبات", en: "View orders" } },
      { key: "orders.edit", label: { ar: "تعديل الطلبات", en: "Edit orders" } },
      { key: "orders.cancel", label: { ar: "إلغاء الطلبات", en: "Cancel orders" } },
      { key: "orders.refund", label: { ar: "استرداد المبالغ", en: "Refund orders" } },
      { key: "orders.create_manual", label: { ar: "إنشاء طلب يدوي", en: "Create manual order" } },
      { key: "orders.manual_discount", label: { ar: "خصم يدوي", en: "Manual discount" } },
    ],
  },
  {
    id: "products",
    label: { ar: "المنتجات والمخزون", en: "Products & Inventory" },
    perms: [
      { key: "products.manage", label: { ar: "إدارة المنتجات", en: "Manage products" } },
      { key: "inventory.manage", label: { ar: "إدارة المخزون", en: "Manage inventory" } },
    ],
  },
  {
    id: "customers",
    label: { ar: "العملاء", en: "Customers" },
    perms: [
      { key: "customers.view", label: { ar: "عرض العملاء", en: "View customers" } },
      { key: "customers.view_pii", label: { ar: "عرض البيانات الحساسة", en: "View PII (email/phone)" } },
      { key: "customers.manage", label: { ar: "إدارة العملاء", en: "Manage customers" } },
      { key: "customers.export", label: { ar: "تصدير العملاء", en: "Export customers" } },
    ],
  },
  {
    id: "marketing",
    label: { ar: "التسويق", en: "Marketing" },
    perms: [
      { key: "coupons.manage", label: { ar: "إدارة الكوبونات", en: "Manage coupons" } },
      { key: "storefront.manage", label: { ar: "إدارة الواجهة", en: "Manage storefront" } },
    ],
  },
  {
    id: "finance",
    label: { ar: "المالية", en: "Finance" },
    perms: [
      { key: "finance.view", label: { ar: "عرض المالية", en: "View finance" } },
      { key: "finance.payment_settings", label: { ar: "إعدادات الدفع", en: "Payment settings" } },
      { key: "finance.shipping_settings", label: { ar: "إعدادات الشحن", en: "Shipping settings" } },
      { key: "invoices.manage", label: { ar: "إدارة الفواتير", en: "Manage invoices" } },
    ],
  },
  {
    id: "support",
    label: { ar: "الدعم", en: "Support" },
    perms: [
      { key: "returns.manage", label: { ar: "إدارة المرتجعات", en: "Manage returns" } },
      { key: "support.tickets", label: { ar: "تذاكر الدعم", en: "Support tickets" } },
    ],
  },
  {
    id: "system",
    label: { ar: "النظام", en: "System" },
    perms: [
      { key: "reports.view", label: { ar: "عرض التقارير", en: "View reports" } },
      { key: "audit.view", label: { ar: "عرض سجل العمليات", en: "View audit log" } },
      { key: "integrations.manage", label: { ar: "إدارة التكاملات", en: "Manage integrations" } },
      { key: "settings.manage", label: { ar: "إدارة الإعدادات", en: "Manage settings" } },
      { key: "users.manage", label: { ar: "إدارة المستخدمين", en: "Manage users" } },
    ],
  },
];

const ROLES: { key: string; label: { ar: string; en: string }; locked?: boolean }[] = [
  { key: "super_admin", label: { ar: "مدير عام", en: "Super admin" }, locked: true },
  { key: "admin", label: { ar: "مدير", en: "Admin" }, locked: true },
  { key: "manager", label: { ar: "مشرف", en: "Manager" } },
  { key: "store_manager", label: { ar: "مدير متجر", en: "Store manager" } },
  { key: "orders_manager", label: { ar: "مدير طلبات", en: "Orders manager" } },
  { key: "inventory_manager", label: { ar: "مدير مخزون", en: "Inventory manager" } },
  { key: "marketing_manager", label: { ar: "مدير تسويق", en: "Marketing manager" } },
  { key: "finance_manager", label: { ar: "مدير مالي", en: "Finance manager" } },
  { key: "content_manager", label: { ar: "مدير محتوى", en: "Content manager" } },
  { key: "support", label: { ar: "دعم", en: "Support" } },
  { key: "developer", label: { ar: "مطور", en: "Developer" } },
  { key: "staff", label: { ar: "موظف", en: "Staff" } },
  { key: "viewer", label: { ar: "مشاهد", en: "Viewer" } },
];

type Matrix = Record<string, Set<string>>; // role -> set of permissions

function PermissionsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [original, setOriginal] = useState<Matrix>({});
  const [search, setSearch] = useState("");
  const [activeRole, setActiveRole] = useState<string>(ROLES[2].key);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("role_permissions").select("role,permission");
    if (error) toast.error(error.message);
    const m: Matrix = {};
    for (const r of ROLES) m[r.key] = new Set();
    for (const row of data ?? []) {
      if (!m[row.role]) m[row.role] = new Set();
      m[row.role].add(row.permission);
    }
    setMatrix(m);
    setOriginal(structuredClone(m as any));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (role: string, perm: string) => {
    const lockedRole = ROLES.find((r) => r.key === role)?.locked;
    if (lockedRole) {
      toast.warning(ar ? "هذا الدور مقفول" : "This role is locked");
      return;
    }
    setMatrix((prev) => {
      const next = { ...prev };
      const set = new Set(next[role] ?? []);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      next[role] = set;
      return next;
    });
  };

  const dirty = useMemo(() => {
    for (const role of Object.keys(matrix)) {
      const a = matrix[role] ?? new Set();
      const b = original[role] ?? new Set();
      if (a.size !== b.size) return true;
      for (const v of a) if (!b.has(v)) return true;
    }
    return false;
  }, [matrix, original]);

  const filteredCatalog = useMemo(() => {
    if (!search.trim()) return CATALOG;
    const q = search.toLowerCase();
    return CATALOG.map((g) => ({
      ...g,
      perms: g.perms.filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          p.label.ar.includes(search) ||
          p.label.en.toLowerCase().includes(q),
      ),
    })).filter((g) => g.perms.length > 0);
  }, [search]);

  const save = async () => {
    setSaving(true);
    const toAdd: { role: string; permission: string }[] = [];
    const toRemove: { role: string; permission: string }[] = [];
    for (const role of Object.keys(matrix)) {
      const cur = matrix[role] ?? new Set();
      const orig = original[role] ?? new Set();
      for (const p of cur) if (!orig.has(p)) toAdd.push({ role, permission: p });
      for (const p of orig) if (!cur.has(p)) toRemove.push({ role, permission: p });
    }
    try {
      if (toAdd.length) {
        const { error } = await supabase.from("role_permissions").insert(toAdd as any);
        if (error) throw error;
      }
      for (const r of toRemove) {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", r.role as any)
          .eq("permission", r.permission);
        if (error) throw error;
      }
      toast.success(
        ar
          ? `تم الحفظ — أُضيف ${toAdd.length} وحُذف ${toRemove.length}`
          : `Saved — ${toAdd.length} added, ${toRemove.length} removed`,
      );
      await load();
    } catch (e: any) {
      toast.error(ar ? "فشل الحفظ" : "Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMatrix(structuredClone(original as any));
    toast.info(ar ? "تم التراجع عن التغييرات" : "Changes reverted");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const totalPerms = CATALOG.reduce((s, g) => s + g.perms.length, 0);
  const activeLocked = ROLES.find((r) => r.key === activeRole)?.locked;

  return (
    <div>
      <PageHeader
        title={{ ar: "الأدوار والصلاحيات", en: "Roles & Permissions" }}
        description={{
          ar: "حدّد الصلاحيات لكل دور بشكل مرئي ودقيق",
          en: "Define permissions per role with a visual matrix",
        }}
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <RotateCcw className="h-3 w-3" />
                {ar ? "تراجع" : "Reset"}
              </button>
            )}
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {ar ? "حفظ التغييرات" : "Save changes"}
            </button>
          </div>
        }
      />

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ar ? "ابحث في الصلاحيات…" : "Search permissions…"}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        {/* Roles list */}
        <aside className="rounded-lg border border-border bg-card p-2">
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase text-muted-foreground">
            {ar ? "الأدوار" : "Roles"}
          </div>
          <div className="space-y-0.5">
            {ROLES.map((r) => {
              const count = matrix[r.key]?.size ?? 0;
              const isWildcard = matrix[r.key]?.has("*");
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveRole(r.key)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition ${
                    activeRole === r.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {r.locked && <ShieldCheck className="h-3 w-3" />}
                    {ar ? r.label.ar : r.label.en}
                  </span>
                  <span className={`text-[10px] ${activeRole === r.key ? "opacity-80" : "text-muted-foreground"}`}>
                    {isWildcard ? "ALL" : `${count}/${totalPerms}`}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Permissions matrix for active role */}
        <section className="space-y-3">
          {activeLocked && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              {ar
                ? "هذا الدور يملك صلاحيات كاملة (*) ولا يمكن تعديله."
                : "This role has full wildcard (*) access and cannot be edited."}
            </div>
          )}

          {filteredCatalog.map((group) => {
            const set = matrix[activeRole] ?? new Set();
            const allChecked = group.perms.every((p) => set.has(p.key));
            const someChecked = group.perms.some((p) => set.has(p.key));
            return (
              <div key={group.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="text-sm font-medium">{ar ? group.label.ar : group.label.en}</div>
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = !allChecked && someChecked;
                      }}
                      disabled={activeLocked}
                      onChange={() => {
                        if (activeLocked) return;
                        setMatrix((prev) => {
                          const next = { ...prev };
                          const s = new Set(next[activeRole] ?? []);
                          if (allChecked) group.perms.forEach((p) => s.delete(p.key));
                          else group.perms.forEach((p) => s.add(p.key));
                          next[activeRole] = s;
                          return next;
                        });
                      }}
                      className="h-3.5 w-3.5"
                    />
                    {ar ? "تحديد المجموعة" : "Toggle all"}
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                  {group.perms.map((p) => {
                    const checked = set.has(p.key);
                    return (
                      <label
                        key={p.key}
                        className={`flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition ${
                          checked
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-background hover:bg-muted"
                        } ${activeLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <span>
                          <div>{ar ? p.label.ar : p.label.en}</div>
                          <div className="text-[10px] text-muted-foreground">{p.key}</div>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={activeLocked}
                          onChange={() => toggle(activeRole, p.key)}
                          className="h-4 w-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredCatalog.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
              {ar ? "لا توجد صلاحيات مطابقة" : "No matching permissions"}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
