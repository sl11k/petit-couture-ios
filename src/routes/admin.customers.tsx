import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useTr } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
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

function CustomersPage() {
  const tr = useTr();
  const { lang } = useLanguage();
  const { isAdmin, isManager, canManage } = useUserRole();
  const canExport = isAdmin || isManager;

  const statusLabel: Record<string, string> = {
    active: tr("نشط", "Active"),
    blocked: tr("محظور", "Blocked"),
    needs_review: tr("يحتاج مراجعة", "Needs review"),
  };

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
    if (!canManage) return alert(tr("لا تملك صلاحية تغيير الحالة", "You don't have permission to change status"));
    if (status === "blocked" && !confirm(tr(`حظر العميل "${c.full_name ?? c.email}"؟`, `Block customer "${c.full_name ?? c.email}"?`))) return;
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
    if (!canExport) return alert(tr("التصدير للإدمن/المدير فقط", "Export is for admins/managers only"));
    const headers = lang === "ar"
      ? ["الاسم", "الإيميل", "الجوال", "المدينة", "الحالة", "المصدر", "عدد الطلبات", "إجمالي المشتريات", "آخر طلب", "تاريخ التسجيل"]
      : ["Name", "Email", "Phone", "City", "Status", "Source", "Orders", "Total spent", "Last order", "Joined"];
    const rows = [
      headers,
      ...filtered.map((c) => {
        const s = stats[c.user_id] ?? { count: 0, total: 0, lastAt: null };
        return [
          c.full_name ?? "", c.email ?? "", c.phone ?? "", c.city ?? "",
          statusLabel[c.status] ?? c.status, c.source,
          String(s.count), s.total.toFixed(2),
          s.lastAt ? new Date(s.lastAt).toLocaleString(lang === "ar" ? "ar" : "en") : "",
          new Date(c.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en"),
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
          <h1 className="text-xl font-semibold">{tr("العملاء", "Customers")} ({filtered.length})</h1>
          <p className="text-xs text-muted-foreground">{tr("إدارة شاملة لعملاء المتجر، حالاتهم، وسجل تواصلهم", "Comprehensive management of store customers, their status, and contact history")}</p>
        </div>
        <button onClick={exportCSV} disabled={!canExport}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> {tr("تصدير CSV", "Export CSV")}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("بحث: اسم / إيميل / جوال / مدينة...", "Search: name / email / phone / city...")}
            className="w-full rounded-md border border-border bg-background py-2 pr-10 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="all">{tr("كل الحالات", "All statuses")}</option>
          <option value="active">{tr("نشط", "Active")}</option>
          <option value="blocked">{tr("محظور", "Blocked")}</option>
          <option value="needs_review">{tr("يحتاج مراجعة", "Needs review")}</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="all">{tr("كل المصادر", "All sources")}</option>
          <option value="web">{tr("الموقع", "Website")}</option>
          <option value="whatsapp">{tr("واتساب", "WhatsApp")}</option>
          <option value="campaign">{tr("حملة", "Campaign")}</option>
          <option value="manual">{tr("طلب يدوي", "Manual")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">{tr("جاري التحميل...", "Loading...")}</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">{tr("العميل", "Customer")}</th>
                <th className="p-3">{tr("الجوال", "Phone")}</th>
                <th className="p-3">{tr("المدينة", "City")}</th>
                <th className="p-3 text-center">{tr("الطلبات", "Orders")}</th>
                <th className="p-3 text-center">{tr("الإجمالي", "Total")}</th>
                <th className="p-3">{tr("آخر طلب", "Last order")}</th>
                <th className="p-3">{tr("المصدر", "Source")}</th>
                <th className="p-3">{tr("الحالة", "Status")}</th>
                <th className="p-3">{tr("التسجيل", "Joined")}</th>
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
                      {s.lastAt ? new Date(s.lastAt).toLocaleDateString(lang === "ar" ? "ar" : "en") : "—"}
                    </td>
                    <td className="p-3 text-[11px]">{sourceLabel(c.source, tr)}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusColor[c.status] ?? "bg-gray-100"}`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en")}</td>
                    <td className="p-3">
                      <div className="flex gap-0.5">
                        <Link to="/admin/customers/$id" params={{ id: c.user_id }} className="rounded p-1.5 hover:bg-muted" title={tr("عرض الملف", "View profile")}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        {c.phone && (
                          <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                            className="rounded p-1.5 hover:bg-muted" title={tr("واتساب", "WhatsApp")}>
                            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="rounded p-1.5 hover:bg-muted" title={tr("إيميل", "Email")}>
                            <Mail className="h-3.5 w-3.5 text-blue-600" />
                          </a>
                        )}
                        {canManage && c.status !== "blocked" && (
                          <button onClick={() => setStatus(c, "blocked")} className="rounded p-1.5 hover:bg-destructive/10" title={tr("حظر", "Block")}>
                            <Ban className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                        {canManage && c.status === "blocked" && (
                          <button onClick={() => setStatus(c, "active")} className="rounded p-1.5 hover:bg-green-50" title={tr("إلغاء الحظر", "Unblock")}>
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </button>
                        )}
                        {canManage && c.status !== "needs_review" && (
                          <button onClick={() => setStatus(c, "needs_review")} className="rounded p-1.5 hover:bg-yellow-50" title={tr("وضع علامة مراجعة", "Mark for review")}>
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-xs text-muted-foreground">{tr("لا يوجد عملاء مطابقون", "No matching customers")}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function sourceLabel(s: string, tr: (ar: string, en: string) => string) {
  const m: Record<string, string> = {
    web: tr("الموقع", "Website"),
    whatsapp: tr("واتساب", "WhatsApp"),
    campaign: tr("حملة", "Campaign"),
    manual: tr("يدوي", "Manual"),
  };
  return m[s] ?? s;
}
