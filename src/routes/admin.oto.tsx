import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Truck, Settings, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/oto")({
  component: OtoPage,
});

function OtoPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [oto, setOto] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("integrations")
        .select("*")
        .eq("category", "shipping")
        .eq("provider", "oto")
        .maybeSingle();
      setOto(data);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title={{ ar: "OTO للشحن", en: "OTO Shipping" }}
        description={{ ar: "تكامل بوابة الشحن OTO", en: "OTO shipping gateway integration" }}
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
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4 text-primary" />
              {ar ? "حالة التكامل" : "Integration status"}
            </div>
            {oto ? (
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <Stat label={ar ? "مفعّل" : "Enabled"} value={oto.enabled ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")} ok={oto.enabled} />
                <Stat label={ar ? "الوضع" : "Mode"} value={oto.mode} />
                <Stat label={ar ? "آخر اختبار" : "Last test"} value={oto.last_test_ok === null ? "—" : oto.last_test_ok ? "OK" : "FAIL"} ok={oto.last_test_ok} />
                <Stat label={ar ? "Webhook" : "Webhook"} value={oto.webhook_url ? "✓" : "—"} />
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                {ar ? "لم يتم تكوين OTO بعد. أضفه من صفحة التكاملات." : "OTO not configured yet. Add it from Integrations."}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">{ar ? "ميزات OTO" : "OTO features"}</p>
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
