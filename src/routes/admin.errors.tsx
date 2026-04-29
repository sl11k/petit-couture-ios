import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ERRORS, type ErrorCode } from "@/lib/errors";
import { AlertTriangle, CheckCircle2, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface ErrorRow {
  id: string;
  code: string;
  severity: string;
  category: string;
  message_admin: string;
  suggested_action: string | null;
  context: Record<string, unknown>;
  user_id: string | null;
  order_id: string | null;
  url: string | null;
  resolved: boolean;
  created_at: string;
}

export const Route = createFileRoute("/admin/errors")({
  head: () => ({ meta: [{ title: "سجل الأخطاء — لوحة الإدارة" }] }),
  component: AdminErrorsPage,
});

function severityBadge(s: string) {
  const map: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground",
    error: "bg-destructive/15 text-destructive",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    info: "bg-muted text-muted-foreground",
  };
  return map[s] ?? map.info;
}

function AdminErrorsPage() {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unresolved" | "critical">("unresolved");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = async () => {
    setLoading(true);
    let q = sb
      .from("error_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filter === "unresolved") q = q.eq("resolved", false);
    if (filter === "critical") q = q.eq("severity", "critical");
    if (categoryFilter !== "all") q = q.eq("category", categoryFilter);

    const { data, error } = await q;
    if (error) {
      toast.error("فشل تحميل سجل الأخطاء");
    } else {
      setRows((data ?? []) as ErrorRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, categoryFilter, page]);

  const stats = useMemo(() => {
    const total = rows.length;
    const critical = rows.filter((r) => r.severity === "critical").length;
    const errors = rows.filter((r) => r.severity === "error").length;
    const warnings = rows.filter((r) => r.severity === "warning").length;
    return { total, critical, errors, warnings };
  }, [rows]);

  const resolve = async (id: string) => {
    const { error } = await sb
      .from("error_logs")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error("فشل تحديث الحالة");
    toast.success("تم وضع علامة مُعالَج");
    setRows((r) => r.map((x) => (x.id === id ? { ...x, resolved: true } : x)));
  };

  const categories = ["all", "payment", "stock", "shipping", "discount", "location", "messaging", "webhook", "network", "checkout", "system"];

  return (
    <AdminShell>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              سجل الأخطاء
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              جميع حالات الخطأ التي يواجهها العملاء أو النظام، مع رسائل تفصيلية وإجراءات مقترحة.
            </p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> تحديث
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="إجمالي السجلات (الصفحة)" value={stats.total} />
          <StatCard label="حرجة" value={stats.critical} tone="destructive" />
          <StatCard label="أخطاء" value={stats.errors} tone="destructive" />
          <StatCard label="تحذيرات" value={stats.warnings} tone="warning" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["unresolved", "critical", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`px-3 py-1.5 rounded-md text-xs border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {f === "unresolved" ? "غير معالجة" : f === "critical" ? "حرجة فقط" : "الكل"}
            </button>
          ))}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="px-3 py-1.5 rounded-md text-xs border bg-background"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === "all" ? "كل الفئات" : c}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-right p-3">الوقت</th>
                  <th className="text-right p-3">الكود</th>
                  <th className="text-right p-3">الخطورة</th>
                  <th className="text-right p-3">الفئة</th>
                  <th className="text-right p-3">رسالة الإدارة</th>
                  <th className="text-right p-3">الإجراء المقترح</th>
                  <th className="text-right p-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جارٍ التحميل…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد أخطاء — كل شيء يسير بسلاسة 🎉</td></tr>
                )}
                {rows.map((r) => {
                  const def = ERRORS[r.code as ErrorCode];
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30 align-top">
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("ar-EG")}
                      </td>
                      <td className="p-3 font-mono text-xs">{r.code}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${severityBadge(r.severity)}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{r.category}</td>
                      <td className="p-3 text-xs max-w-xs">
                        <div>{r.message_admin || def?.admin}</div>
                        {r.url && <div className="text-[10px] text-muted-foreground mt-1 truncate">{r.url}</div>}
                        {Object.keys(r.context ?? {}).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-[10px] cursor-pointer text-primary">تفاصيل السياق</summary>
                            <pre className="text-[10px] mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(r.context, null, 2)}</pre>
                          </details>
                        )}
                      </td>
                      <td className="p-3 text-xs max-w-xs text-muted-foreground">
                        {r.suggested_action || def?.action}
                      </td>
                      <td className="p-3">
                        {r.resolved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> مُعالَج
                          </span>
                        ) : (
                          <button
                            onClick={() => resolve(r.id)}
                            className="text-xs px-2 py-1 rounded-md border hover:bg-muted"
                          >
                            وضع كـ مُعالَج
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-md border disabled:opacity-50"
          >
            السابق
          </button>
          <span className="text-xs text-muted-foreground">صفحة {page + 1}</span>
          <button
            disabled={rows.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border disabled:opacity-50"
          >
            التالي
          </button>
        </div>

        {/* Catalog reference */}
        <details className="rounded-lg border p-4">
          <summary className="font-medium cursor-pointer">📖 كتالوج جميع رموز الأخطاء ({Object.keys(ERRORS).length})</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.values(ERRORS).map((e) => (
              <div key={e.code} className="rounded border p-3 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{e.code}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${severityBadge(e.severity)}`}>{e.severity}</span>
                  <span className="text-muted-foreground text-[10px]">{e.category}</span>
                </div>
                {e.customer && <p>👤 <strong>للعميل:</strong> {e.customer}</p>}
                <p>🛠️ <strong>للإدارة:</strong> {e.admin}</p>
                <p className="text-muted-foreground">▶️ {e.action}</p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </AdminShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "destructive" | "warning" }) {
  const color = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
