import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import {
  Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight, X, Webhook, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/webhooks-deliveries")({
  component: DeliveriesPage,
});

type Delivery = {
  id: string; endpoint_id: string | null; event_type: string; status: string;
  http_status: number | null; attempt: number; max_attempts: number;
  error_message: string | null; response_body: string | null;
  payload: any; next_retry_at: string | null; delivered_at: string | null;
  created_at: string;
};
type Endpoint = { id: string; name: string; url: string };

const STATUSES = ["all", "success", "failed", "retrying", "pending"] as const;
const PAGE_SIZE = 25;

function DeliveriesPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);

  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [endpointId, setEndpointId] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selected, setSelected] = useState<Delivery | null>(null);

  useEffect(() => {
    supabase.from("webhook_endpoints").select("id, name, url").then(r => setEndpoints((r.data as Endpoint[]) || []));
  }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("webhook_deliveries").select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (status !== "all") q = q.eq("status", status);
    if (endpointId !== "all") q = q.eq("endpoint_id", endpointId);
    if (eventType.trim()) q = q.ilike("event_type", `%${eventType.trim()}%`);
    if (from) q = q.gte("created_at", new Date(from + "T00:00:00").toISOString());
    if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
    const r = await q;
    if (r.error) toast.error(r.error.message);
    setRows((r.data as Delivery[]) || []);
    setTotal(r.count || 0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, endpointId, eventType, from, to, page]);
  useEffect(() => { setPage(0); }, [status, endpointId, eventType, from, to]);

  const endpointMap = useMemo(() => {
    const m = new Map<string, Endpoint>();
    endpoints.forEach(e => m.set(e.id, e));
    return m;
  }, [endpoints]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const retry = async (d: Delivery) => {
    const { error } = await supabase.from("webhook_deliveries").update({
      status: "retrying", next_retry_at: new Date().toISOString(),
    }).eq("id", d.id);
    if (error) toast.error(error.message);
    else { toast.success(t("تمت جدولة الإعادة", "Retry scheduled")); load(); }
  };

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={{ ar: "تسليمات Webhooks", en: "Webhook Deliveries" }}
        description={{ ar: "سجل المحاولات مع الفلترة والـ payload", en: "Delivery attempts log with filters and payload" }}
      />

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value as any)}
          className="px-2 py-1.5 rounded-md border text-xs bg-background">
          {STATUSES.map(s => <option key={s} value={s}>{s === "all" ? t("الكل", "All") : s}</option>)}
        </select>
        <select value={endpointId} onChange={e => setEndpointId(e.target.value)}
          className="px-2 py-1.5 rounded-md border text-xs bg-background min-w-[180px]">
          <option value="all">{t("كل المنصات", "All endpoints")}</option>
          {endpoints.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input type="text" value={eventType} onChange={e => setEventType(e.target.value)}
          placeholder={t("نوع الحدث (مثال: order.paid)", "Event type (e.g. order.paid)")}
          className="px-2 py-1.5 rounded-md border text-xs bg-background min-w-[200px]" />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-2 py-1.5 rounded-md border text-xs bg-background" />
        <span className="text-xs text-muted-foreground">→</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-2 py-1.5 rounded-md border text-xs bg-background" />
        <button onClick={load} className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border bg-background hover:bg-muted">
          <RefreshCw className="size-3.5" /> {t("تحديث", "Refresh")}
        </button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">{t("لا توجد تسليمات", "No deliveries")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs bg-muted/40">
                <tr>
                  <th className="text-start py-2 px-3">{t("الوقت", "Time")}</th>
                  <th className="text-start py-2 px-3">{t("المنصة", "Endpoint")}</th>
                  <th className="text-start py-2 px-3">{t("الحدث", "Event")}</th>
                  <th className="text-start py-2 px-3">{t("الحالة", "Status")}</th>
                  <th className="text-start py-2 px-3">HTTP</th>
                  <th className="text-start py-2 px-3">{t("المحاولة", "Attempt")}</th>
                  <th className="text-start py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(d => {
                  const ep = d.endpoint_id ? endpointMap.get(d.endpoint_id) : null;
                  return (
                    <tr key={d.id} className="border-t hover:bg-muted/30">
                      <td className="py-2 px-3 text-xs whitespace-nowrap">{format(new Date(d.created_at), "MM-dd HH:mm:ss")}</td>
                      <td className="py-2 px-3">
                        <div className="text-sm">{ep?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">{ep?.url}</div>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono">{d.event_type}</td>
                      <td className="py-2 px-3"><StatusBadge s={d.status} /></td>
                      <td className="py-2 px-3"><HttpBadge code={d.http_status} /></td>
                      <td className="py-2 px-3 text-xs">{d.attempt}/{d.max_attempts}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelected(d)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted">
                            <Eye className="size-3" /> {t("عرض", "View")}
                          </button>
                          {d.status === "failed" && (
                            <button onClick={() => retry(d)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted">
                              <RotateCcw className="size-3" /> {t("إعادة", "Retry")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/20 text-xs">
          <div className="text-muted-foreground">
            {t("إجمالي", "Total")}: {total} · {t("صفحة", "Page")} {page + 1}/{totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
              className="p-1 rounded border hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="size-4" />
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="p-1 rounded border hover:bg-muted disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {selected && <PayloadDialog d={selected} ep={selected.endpoint_id ? endpointMap.get(selected.endpoint_id) ?? null : null} onClose={() => setSelected(null)} ar={ar} />}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-600",
    failed: "bg-rose-500/15 text-rose-600",
    retrying: "bg-amber-500/15 text-amber-600",
    pending: "bg-slate-500/15 text-slate-600",
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[s] || "bg-muted"}`}>{s}</span>;
}
function HttpBadge({ code }: { code: number | null }) {
  if (!code) return <span className="text-xs text-muted-foreground">—</span>;
  const ok = code >= 200 && code < 300;
  return <span className={`text-xs font-mono ${ok ? "text-emerald-600" : "text-rose-600"}`}>{code}</span>;
}

function PayloadDialog({ d, ep, onClose, ar }: { d: Delivery; ep: Endpoint | null; onClose: () => void; ar: boolean }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const payloadStr = useMemo(() => {
    try { return JSON.stringify(d.payload, null, 2); } catch { return String(d.payload); }
  }, [d.payload]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} dir={ar ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Webhook className="size-4" />
            <div>
              <div className="font-medium text-sm">{ep?.name || t("غير محدد", "Unknown")} — {d.event_type}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(d.created_at), "yyyy-MM-dd HH:mm:ss")}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Field label={t("الحالة", "Status")}><StatusBadge s={d.status} /></Field>
            <Field label="HTTP"><HttpBadge code={d.http_status} /></Field>
            <Field label={t("المحاولة", "Attempt")}>{d.attempt}/{d.max_attempts}</Field>
            <Field label={t("التسليم", "Delivered")}>{d.delivered_at ? format(new Date(d.delivered_at), "MM-dd HH:mm:ss") : "—"}</Field>
          </div>
          {ep?.url && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">URL</div>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{ep.url}</code>
            </div>
          )}
          {d.error_message && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("رسالة الخطأ", "Error message")}</div>
              <pre className="text-xs bg-rose-500/10 text-rose-600 p-3 rounded overflow-x-auto whitespace-pre-wrap">{d.error_message}</pre>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Payload</div>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-72" dir="ltr">{payloadStr}</pre>
          </div>
          {d.response_body && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("الرد", "Response body")}</div>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48" dir="ltr">{d.response_body}</pre>
            </div>
          )}
        </div>
        <div className="p-3 border-t flex justify-end">
          <button onClick={() => navigator.clipboard.writeText(payloadStr).then(() => toast.success(t("تم النسخ", "Copied")))}
            className="px-3 py-1.5 rounded-md text-xs border hover:bg-muted">
            {t("نسخ Payload", "Copy payload")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{children}</div>
    </div>
  );
}
