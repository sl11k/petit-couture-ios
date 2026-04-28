import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { Search, Filter, Download, Eye, Lock } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({ component: AuditAdmin });

type Log = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: any;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

function AuditAdmin() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [active, setActive] = useState<Log | null>(null);

  useEffect(() => {
    setLoading(true);
    void supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => { setLogs((data ?? []) as Log[]); setLoading(false); });
  }, []);

  const filtered = useMemo(() => logs.filter((l) => {
    if (filter) {
      const q = filter.toLowerCase();
      if (!(l.action.toLowerCase().includes(q) || l.actor_email?.toLowerCase().includes(q) ||
            l.entity?.toLowerCase().includes(q) || l.entity_id?.toLowerCase().includes(q))) return false;
    }
    if (actionFilter && !l.action.includes(actionFilter)) return false;
    if (entityFilter && l.entity !== entityFilter) return false;
    const t = new Date(l.created_at).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 86400000) return false;
    return true;
  }), [logs, filter, actionFilter, entityFilter, from, to]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const entities = useMemo(() => Array.from(new Set(logs.map((l) => l.entity).filter(Boolean))).sort() as string[], [logs]);

  function exportCSV() {
    const header = ["التاريخ","المستخدم","العملية","الكيان","المعرف","IP","تفاصيل"];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toISOString(), l.actor_email ?? "", l.action,
      l.entity ?? "", l.entity_id ?? "", l.ip_address ?? "",
      JSON.stringify(l.metadata ?? {}).replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />سجل العمليات (Audit Log)</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} سجل — السجلات غير قابلة للتعديل أو الحذف</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
          <Download className="h-3.5 w-3.5" /> تصدير CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="بحث..."
            className="w-full rounded-md border border-border bg-background py-1.5 pe-8 ps-2 text-xs" />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="">كل العمليات</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="">كل الكيانات</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">المستخدم</th>
                <th className="p-3">العملية</th>
                <th className="p-3">الكيان</th>
                <th className="p-3">IP</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("ar")}</td>
                  <td className="p-3 text-xs">{l.actor_email ?? "—"}</td>
                  <td className="p-3"><span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{l.action}</span></td>
                  <td className="p-3 text-xs">{l.entity ?? "—"}{l.entity_id && <span className="block font-mono text-[10px] text-muted-foreground">{l.entity_id.slice(0, 8)}</span>}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">{l.ip_address ?? "—"}</td>
                  <td className="p-3"><button onClick={() => setActive(l)} className="rounded p-1 hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">لا توجد سجلات</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setActive(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{active.action}</h2>
                <p className="text-xs text-muted-foreground">{new Date(active.created_at).toLocaleString("ar")}</p>
              </div>
              <button onClick={() => setActive(null)} className="rounded p-1 hover:bg-muted">✕</button>
            </div>
            <div className="grid gap-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Field label="المستخدم" value={active.actor_email} />
                <Field label="الكيان" value={active.entity} />
                <Field label="معرف الكيان" value={active.entity_id} mono />
                <Field label="IP" value={active.ip_address} mono />
              </div>
              {active.user_agent && <Field label="User Agent" value={active.user_agent} mono />}
              {active.metadata && Object.keys(active.metadata).length > 0 && (
                <div>
                  <p className="mb-1 font-semibold text-muted-foreground">البيانات الإضافية</p>
                  <pre className="rounded bg-muted/30 p-2 font-mono text-[10px]">{JSON.stringify(active.metadata, null, 2)}</pre>
                </div>
              )}
              {active.old_data && (
                <div>
                  <p className="mb-1 font-semibold text-rose-600">البيانات السابقة</p>
                  <pre className="rounded bg-rose-50 p-2 font-mono text-[10px] dark:bg-rose-950/20">{JSON.stringify(active.old_data, null, 2)}</pre>
                </div>
              )}
              {active.new_data && (
                <div>
                  <p className="mb-1 font-semibold text-emerald-600">البيانات الجديدة</p>
                  <pre className="rounded bg-emerald-50 p-2 font-mono text-[10px] dark:bg-emerald-950/20">{JSON.stringify(active.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono break-all" : ""}>{value ?? "—"}</p>
    </div>
  );
}
