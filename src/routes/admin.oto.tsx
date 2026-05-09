import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminLayout";
import { otoTestConnection, otoListShipments, otoSyncShipment } from "@/lib/oto.functions";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Copy, ExternalLink, Truck, Webhook, Send } from "lucide-react";

export const Route = createFileRoute("/admin/oto")({ component: OtoAdmin });

function OtoAdmin() {
  const { isRTL } = useLanguage();
  const ar = isRTL;
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("integrations.manage") || can("shipping.manage");

  const test = useServerFn(otoTestConnection);
  const list = useServerFn(otoListShipments);
  const sync = useServerFn(otoSyncShipment);

  const [conn, setConn] = useState<{ ok?: boolean; tokenPreview?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/shipping-webhook`
    : "/api/public/shipping-webhook";

  async function loadList() {
    setLoading(true);
    try {
      const res: any = await list({ data: undefined as any });
      setItems(res?.items || []);
    } catch (e: any) {
      toast.error(e?.message || "Load failed");
    }
    setLoading(false);
  }

  useEffect(() => { void loadList(); /* test connection on mount */ void runTest(); }, []);

  async function runTest() {
    setTesting(true);
    try {
      const r: any = await test({ data: undefined as any });
      setConn(r);
    } catch (e: any) {
      setConn({ ok: false, error: e?.message });
    }
    setTesting(false);
  }

  async function runSync(id: string) {
    setSyncing(id);
    try {
      const r: any = await sync({ data: { shipmentId: id } });
      if (r?.ok) toast.success(`✓ ${r.status || "synced"}`);
      else toast.error(r?.error || "Sync failed");
      await loadList();
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    }
    setSyncing(null);
  }

  function copy(s: string) { navigator.clipboard.writeText(s); toast.success(ar ? "تم النسخ" : "Copied"); }

  if (!allowed) {
    return <AdminShell><div className="p-6 text-sm text-muted-foreground">{ar ? "لا تملك صلاحية" : "Not authorized"}</div></AdminShell>;
  }

  return (
    <AdminShell>
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2"><Truck className="h-5 w-5" /> {ar ? "تكامل OTO للشحن" : "OTO Shipping"}</h1>
            <p className="text-xs text-muted-foreground mt-1">{ar ? "إدارة الشحنات والتكامل مع tryoto.com" : "Manage shipments and tryoto.com integration"}</p>
          </div>
          <button onClick={loadList} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" /> {ar ? "تحديث" : "Refresh"}
          </button>
        </div>

        {/* Connection status */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{ar ? "حالة الاتصال" : "Connection status"}</h2>
            <button onClick={runTest} disabled={testing} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {ar ? "اختبار الاتصال" : "Test connection"}
            </button>
          </div>
          <div className="mt-3 text-sm">
            {conn === null && <span className="text-muted-foreground">…</span>}
            {conn?.ok && (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{ar ? "متصل" : "Connected"} — token: <code className="font-mono text-xs">{conn.tokenPreview}</code></span>
              </div>
            )}
            {conn && !conn.ok && (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-xs">{conn.error}</span>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {ar ? "يستخدم OTO_REFRESH_TOKEN المخزن بشكل آمن في الخادم." : "Uses OTO_REFRESH_TOKEN stored securely on the server."}
          </p>
        </div>

        {/* Webhook URL */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Webhook className="h-4 w-4" /> {ar ? "رابط Webhook" : "Webhook URL"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{ar ? "أضف هذا الرابط في لوحة OTO لتلقي تحديثات حالة الشحن." : "Configure this URL in your OTO dashboard to receive tracking updates."}</p>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={webhookUrl} className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono" />
            <button onClick={() => copy(webhookUrl)} className="rounded-md border border-border p-2 hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {ar ? "السرّ:" : "Secret:"} <code className="font-mono">SHIPPING_WEBHOOK_SECRET</code> · {ar ? "HMAC-SHA256 على الجسم بالكامل، رأس X-Webhook-Signature" : "HMAC-SHA256 of body, header X-Webhook-Signature"}
          </p>
        </div>

        {/* Shipments */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <h2 className="text-sm font-semibold">{ar ? `شحنات OTO (${items.length})` : `OTO shipments (${items.length})`}</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{ar ? "لا توجد شحنات OTO بعد" : "No OTO shipments yet"}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">{ar ? "الطلب" : "Order"}</th>
                    <th className="p-2 text-start">{ar ? "العميل" : "Customer"}</th>
                    <th className="p-2 text-start">{ar ? "المدينة" : "City"}</th>
                    <th className="p-2 text-start">{ar ? "التتبع" : "Tracking"}</th>
                    <th className="p-2 text-start">{ar ? "الحالة" : "Status"}</th>
                    <th className="p-2 text-start">COD</th>
                    <th className="p-2 text-start">{ar ? "تم الإنشاء" : "Created"}</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="p-2">
                        {s.order_id ? (
                          <Link to="/admin/orders/$id" params={{ id: s.order_id }} className="text-primary hover:underline font-mono">{s.order_number}</Link>
                        ) : <span className="font-mono">{s.order_number}</span>}
                      </td>
                      <td className="p-2">{s.customer_name}</td>
                      <td className="p-2">{s.city}</td>
                      <td className="p-2 font-mono">
                        {s.tracking_url ? (
                          <a href={s.tracking_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {s.tracking_number} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : s.tracking_number}
                      </td>
                      <td className="p-2"><StatusPill status={s.status} /></td>
                      <td className="p-2">{Number(s.cod_amount || 0).toFixed(2)}</td>
                      <td className="p-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString(ar ? "ar" : "en")}</td>
                      <td className="p-2 text-end">
                        <button
                          onClick={() => runSync(s.id)}
                          disabled={syncing === s.id || !s.tracking_number}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted disabled:opacity-50"
                        >
                          {syncing === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          {ar ? "مزامنة" : "Sync"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    label_created: "bg-blue-50 text-blue-700",
    picked_up: "bg-indigo-50 text-indigo-700",
    in_transit: "bg-amber-50 text-amber-700",
    out_for_delivery: "bg-orange-50 text-orange-700",
    delivered: "bg-emerald-50 text-emerald-700",
    returned: "bg-red-50 text-red-700",
    failed_delivery: "bg-red-50 text-red-700",
    cancelled: "bg-gray-100 text-gray-700",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}
