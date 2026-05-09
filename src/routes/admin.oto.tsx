import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import {
  Truck,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/oto")({
  component: OtoPage,
});

type Delivery = {
  id: string;
  event_type: string;
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
  response_body: string | null;
};

function OtoPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [oto, setOto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [delivLoading, setDelivLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    http_status: number | null;
    elapsed_ms: number;
    response_preview?: string;
    error?: string | null;
  } | null>(null);

  const loadIntegration = async () => {
    const { data } = await supabase
      .from("integrations")
      .select("*")
      .eq("category", "shipping")
      .eq("provider", "oto")
      .maybeSingle();
    setOto(data);
    setLoading(false);
  };

  const loadDeliveries = async () => {
    setDelivLoading(true);
    const { data } = await supabase
      .from("webhook_deliveries")
      .select(
        "id,event_type,status,http_status,error_message,created_at,delivered_at,response_body",
      )
      .or("event_type.ilike.shipping.%,event_type.ilike.oto.%,event_type.ilike.test.%")
      .order("created_at", { ascending: false })
      .limit(15);
    setDeliveries((data as Delivery[]) ?? []);
    setDelivLoading(false);
  };

  useEffect(() => {
    loadIntegration();
    loadDeliveries();
  }, []);

  const sendTest = async () => {
    if (!oto?.webhook_url) {
      toast.error(
        ar ? "لا يوجد رابط Webhook في إعداد OTO" : "No webhook URL configured for OTO",
      );
      return;
    }
    setTesting(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("webhook-test", {
        body: {
          url: oto.webhook_url,
          secret: oto.webhook_secret ?? undefined,
          event_type: "oto.shipment.test",
          payload: {
            event: "oto.shipment.test",
            integration: "oto",
            sample: {
              order_number: "TEST-OTO-0001",
              tracking_number: "OTO-TRK-TEST-12345",
              status: "in_transit",
              updated_at: new Date().toISOString(),
            },
          },
        },
      });
      if (error) throw error;
      setLastResult(data);

      // Update integration last_test_*
      await supabase
        .from("integrations")
        .update({
          last_test_ok: !!data?.ok,
          last_test_at: new Date().toISOString(),
          last_test_message: data?.ok
            ? `HTTP ${data.http_status} • ${data.elapsed_ms}ms`
            : data?.error ?? `HTTP ${data?.http_status ?? "?"}`,
        })
        .eq("id", oto.id);

      toast[data?.ok ? "success" : "error"](
        data?.ok
          ? ar
            ? `تم الإرسال (HTTP ${data.http_status})`
            : `Sent (HTTP ${data.http_status})`
          : ar
            ? `فشل الإرسال`
            : `Send failed`,
      );
      await Promise.all([loadDeliveries(), loadIntegration()]);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={{ ar: "OTO للشحن", en: "OTO Shipping" }}
        description={{
          ar: "تكامل بوابة الشحن OTO وآخر نتائج Webhook",
          en: "OTO shipping integration & latest webhook results",
        }}
        actions={
          <Link
            to="/admin/integrations"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Settings className="h-3 w-3" /> {ar ? "إدارة التكاملات" : "Manage integrations"}
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4 text-primary" />
                {ar ? "حالة التكامل" : "Integration status"}
              </div>
              <button
                onClick={sendTest}
                disabled={testing || !oto?.webhook_url}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                {ar ? "إرسال Webhook اختباري" : "Send test webhook"}
              </button>
            </div>
            {oto ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <Stat
                    label={ar ? "مفعّل" : "Enabled"}
                    value={oto.enabled ? (ar ? "نعم" : "Yes") : ar ? "لا" : "No"}
                    ok={oto.enabled}
                  />
                  <Stat label={ar ? "الوضع" : "Mode"} value={oto.mode} />
                  <Stat
                    label={ar ? "آخر اختبار" : "Last test"}
                    value={
                      oto.last_test_ok === null ? "—" : oto.last_test_ok ? "OK" : "FAIL"
                    }
                    ok={oto.last_test_ok}
                  />
                  <Stat
                    label="Webhook"
                    value={oto.webhook_url ? "✓" : "—"}
                    ok={!!oto.webhook_url}
                  />
                </div>
                {oto.webhook_url && (
                  <div className="mt-3 truncate rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {oto.webhook_url}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                {ar
                  ? "لم يتم تكوين OTO بعد. أضفه من صفحة التكاملات."
                  : "OTO not configured yet. Add it from Integrations."}
              </div>
            )}
          </div>

          {/* Last test result detail */}
          {lastResult && (
            <div
              className={`rounded-lg border p-4 text-xs ${
                lastResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 font-medium">
                {lastResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {ar ? "نتيجة الاختبار" : "Test result"}: HTTP{" "}
                {lastResult.http_status ?? "—"} • {lastResult.elapsed_ms}ms
              </div>
              {lastResult.error && (
                <div className="mt-1 text-destructive">{lastResult.error}</div>
              )}
              {lastResult.response_preview && (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px]">
                  {lastResult.response_preview}
                </pre>
              )}
            </div>
          )}

          {/* Recent deliveries */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="text-sm font-medium">
                {ar ? "آخر نتائج Webhook" : "Recent webhook deliveries"}
              </div>
              <button
                onClick={loadDeliveries}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-3 w-3 ${delivLoading ? "animate-spin" : ""}`} />
                {ar ? "تحديث" : "Refresh"}
              </button>
            </div>
            {delivLoading ? (
              <div className="flex justify-center p-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {ar
                  ? "لا توجد محاولات Webhook حتى الآن. اضغط على زر الاختبار أعلاه."
                  : "No webhook attempts yet. Use the test button above."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {deliveries.map((d) => {
                  const ok = d.status === "delivered";
                  return (
                    <div key={d.id} className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className="font-medium">{d.event_type}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                            HTTP {d.http_status ?? "—"}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              ok
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(d.created_at).toLocaleString(ar ? "ar" : "en")}
                        </span>
                      </div>
                      {d.error_message && (
                        <div className="mt-1 text-destructive">{d.error_message}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">
              {ar ? "ميزات OTO" : "OTO features"}
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>{ar ? "إنشاء بوالص الشحن تلقائياً" : "Auto-create shipping labels (AWB)"}</li>
              <li>{ar ? "تتبع الشحنات في الوقت الفعلي" : "Real-time shipment tracking"}</li>
              <li>{ar ? "دعم الدفع عند الاستلام" : "Cash on Delivery support"}</li>
              <li>{ar ? "إشعارات webhook للتحديثات" : "Webhook notifications for updates"}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: any; ok?: boolean | null }) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1 text-sm font-medium">
        {ok === true && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
        {ok === false && <XCircle className="h-3.5 w-3.5 text-destructive" />}
        {value}
      </div>
    </div>
  );
}
