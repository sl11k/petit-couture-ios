import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/audit")({
  component: AuditAdmin,
});

type Log = {
  id: string;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: any;
  created_at: string;
};

function AuditAdmin() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setLogs((data ?? []) as Log[]));
  }, []);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return l.action.toLowerCase().includes(q) || l.actor_email?.toLowerCase().includes(q) || l.entity?.toLowerCase().includes(q);
  });

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">سجل العمليات</h1>
        <input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="بحث في السجل..."
          className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-3">التاريخ</th>
              <th className="p-3">المستخدم</th>
              <th className="p-3">العملية</th>
              <th className="p-3">الكيان</th>
              <th className="p-3">تفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar")}</td>
                <td className="p-3 text-xs">{l.actor_email ?? "—"}</td>
                <td className="p-3"><span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{l.action}</span></td>
                <td className="p-3 text-xs">{l.entity ?? "—"}{l.entity_id && <span className="block font-mono text-[10px] text-muted-foreground">{l.entity_id.slice(0, 8)}</span>}</td>
                <td className="p-3 font-mono text-[10px] text-muted-foreground">{Object.keys(l.metadata || {}).length > 0 ? JSON.stringify(l.metadata).slice(0, 80) : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">لا توجد سجلات بعد</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
