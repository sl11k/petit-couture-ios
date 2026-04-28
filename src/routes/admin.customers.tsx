import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { Search, Download, Eye, Ban, CheckCircle, AlertTriangle, MessageCircle, Mail } from "lucide-react";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  source: string;
  tag: string | null;
  loyalty_points: number;
  created_at: string;
};

type Stats = { count: number; total: number; lastAt: string | null };

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-700",
  needs_review: "bg-yellow-100 text-yellow-800",
};
const statusLabel: Record<string, string> = {
  active: "نشط", blocked: "محظور", needs_review: "يحتاج مراجعة",
};

function CustomersPage() {
  const { isAdmin, isManager, canManage } = useUserRole();
  const canExport = isAdmin || isManager;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles").select("*").order("created_at", { ascending: false });
    setCustomers((profiles ?? []) as Customer[]);

    const { data: orders } = await supabase
      .from("orders").select("user_id, total, status, created_at");
    const map: Record<string, Stats> = {};
    (orders ?? []).forEach((o: any) => {
      if (!o.user_id) return;
      if (!map[o.user_id]) map[o.user_id] = { count: 0, total: 0, lastAt: null };
      if (o.status !== "cancelled") {
        map[o.user_id].count++;
        map[o.user_id].total += Number(o.total ?? 0);
      }
      if (!map[o.user_id].lastAt || o.created_at > map[o.user_id].lastAt!) {
        map[o.user_id].lastAt = o.created_at;
      }
    });
    setStats(map);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (!q) return true;
      return (c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) || c.city?.toLowerCase().includes(q));
    });
  }, [customers, search, statusFilter, sourceFilter]);

  async function setStatus(c: Customer, status: string) {
    if (!canManage) return alert("لا تملك صلاحية تغيير الحالة");
    if (status === "blocked" && !confirm(`حظر العميل "${c.full_name ?? c.email}"؟`)) return;
    await supabase.from("profiles").update({ status }).eq("id", c.id);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("audit_logs").insert({
        actor_id: u.user.id, actor_email: u.user.email,
        action: `customer.${status}`, entity: "customer", entity_id: c.user_id,
        metadata: { previous: c.status },
      });
    }
    await load();
  }

  function exportCSV() {
    if (!canExport) return alert("التصدير للإدمن/المدير فقط");
    const rows = [
      ["الاسم", "الإيميل", "الجوال", "المدينة", "الحالة", "المصدر", "عدد الطلبات", "إجمالي المشتريات", "آخر طلب", "تاريخ التسجيل"],
      ...filtered.map((c) => {
        const s = stats[c.user_id] ?? { count: 0, total: 0, lastAt: null };
        return [
          c.full_name ?? "", c.email ?? "", c.phone ?? "", c.city ?? "",
          statusLabel[c.status] ?? c.status, c.source,
          String(s.count), s.total.toFixed(2),
          s.lastAt ? new Date(s.lastAt).toLocaleString("ar") : "",
          new Date(c.created_at).toLocaleDateString("ar"),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">العملاء ({filtered.length})</h1>
          <p className="text-xs text-muted-foreground">إدارة شاملة لعملاء المتجر، حالاتهم، وسجل تواصلهم</p>
        </div>
        <button onClick={exportCSV} disabled={!canExport}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> تصدير CSV
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث: اسم / إيميل / جوال / مدينة..."
            className="w-full rounded-md border border-border bg-background py-2 pr-10 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="blocked">محظور</option>
          <option value="needs_review">يحتاج مراجعة</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="all">كل المصادر</option>
          <option value="web">الموقع</option>
          <option value="whatsapp">واتساب</option>
          <option value="campaign">حملة</option>
          <option value="manual">طلب يدوي</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">العميل</th>
                <th className="p-3">الجوال</th>
                <th className="p-3">المدينة</th>
                <th className="p-3 text-center">الطلبات</th>
                <th className="p-3 text-center">الإجمالي</th>
                <th className="p-3">آخر طلب</th>
                <th className="p-3">المصدر</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">التسجيل</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const s = stats[c.user_id] ?? { count: 0, total: 0, lastAt: null };
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{c.full_name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{c.email}</div>
                      {c.tag && <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{c.tag}</span>}
                    </td>
                    <td className="p-3 font-mono text-xs">{c.phone || "—"}</td>
                    <td className="p-3 text-xs">{c.city || "—"}</td>
                    <td className="p-3 text-center">{s.count}</td>
                    <td className="p-3 text-center font-semibold">{s.total.toFixed(0)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {s.lastAt ? new Date(s.lastAt).toLocaleDateString("ar") : "—"}
                    </td>
                    <td className="p-3 text-[11px]">{sourceLabel(c.source)}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusColor[c.status] ?? "bg-gray-100"}`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar")}</td>
                    <td className="p-3">
                      <div className="flex gap-0.5">
                        <Link to="/admin/customers/$id" params={{ id: c.user_id }} className="rounded p-1.5 hover:bg-muted" title="عرض الملف">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        {c.phone && (
                          <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                            className="rounded p-1.5 hover:bg-muted" title="واتساب">
                            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="rounded p-1.5 hover:bg-muted" title="إيميل">
                            <Mail className="h-3.5 w-3.5 text-blue-600" />
                          </a>
                        )}
                        {canManage && c.status !== "blocked" && (
                          <button onClick={() => setStatus(c, "blocked")} className="rounded p-1.5 hover:bg-destructive/10" title="حظر">
                            <Ban className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                        {canManage && c.status === "blocked" && (
                          <button onClick={() => setStatus(c, "active")} className="rounded p-1.5 hover:bg-green-50" title="إلغاء الحظر">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </button>
                        )}
                        {canManage && c.status !== "needs_review" && (
                          <button onClick={() => setStatus(c, "needs_review")} className="rounded p-1.5 hover:bg-yellow-50" title="وضع علامة مراجعة">
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-xs text-muted-foreground">لا يوجد عملاء مطابقون</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function sourceLabel(s: string) {
  return ({ web: "الموقع", whatsapp: "واتساب", campaign: "حملة", manual: "يدوي" } as Record<string, string>)[s] ?? s;
}
