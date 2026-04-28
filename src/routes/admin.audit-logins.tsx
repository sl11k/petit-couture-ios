import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/audit-logins")({ component: FailedLogins });

type Row = {
  id: string;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  reason: string | null;
  metadata: any;
  created_at: string;
};

function FailedLogins() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    void supabase.from("failed_login_attempts").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, []);

  const filtered = rows.filter((r) => !search || r.email?.toLowerCase().includes(search.toLowerCase()));

  // Group by email to spot brute-force attempts
  const counts = new Map<string, number>();
  rows.forEach((r) => { if (r.email) counts.set(r.email, (counts.get(r.email) ?? 0) + 1); });
  const suspicious = Array.from(counts.entries()).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" /> محاولات الدخول الفاشلة
          </h1>
          <p className="text-xs text-muted-foreground">{rows.length} محاولة — للكشف عن محاولات الاختراق</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالإيميل..."
          className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
      </div>

      {suspicious.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-300/40 bg-rose-50/50 p-3 text-xs dark:bg-rose-950/20">
          <p className="mb-2 font-semibold text-rose-700 dark:text-rose-400">⚠ إيميلات بمحاولات متعددة (3+):</p>
          <div className="flex flex-wrap gap-1.5">
            {suspicious.slice(0, 10).map(([email, c]) => (
              <span key={email} className="rounded bg-rose-100 px-2 py-1 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                {email} — {c} محاولة
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">الإيميل</th>
                <th className="p-3">السبب</th>
                <th className="p-3">IP</th>
                <th className="p-3">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3 text-xs whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</td>
                  <td className="p-3 text-xs">{r.email ?? "—"}</td>
                  <td className="p-3 text-xs text-rose-600">{r.reason ?? "—"}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">{r.ip_address ?? "—"}</td>
                  <td className="p-3 text-[10px] text-muted-foreground truncate max-w-xs">{r.user_agent ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">لا توجد محاولات فاشلة</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
