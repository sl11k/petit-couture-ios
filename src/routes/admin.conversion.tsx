import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Loader2, TrendingUp, ShoppingCart, CreditCard, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/conversion")({
  component: ConversionPage,
});

function ConversionPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [carts, checkouts, paid] = await Promise.all([
        supabase.from("abandoned_carts").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("reached_checkout", true).gte("created_at", since),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").gte("created_at", since),
      ]);
      setData({
        carts: carts.count ?? 0,
        checkouts: checkouts.count ?? 0,
        paid: paid.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const cartToCheckout = data.carts > 0 ? (data.checkouts / data.carts) * 100 : 0;
  const checkoutToPaid = data.checkouts > 0 ? (data.paid / data.checkouts) * 100 : 0;
  const overall = data.carts > 0 ? (data.paid / data.carts) * 100 : 0;

  const Step = ({ icon: Icon, label, count, percent }: any) => (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-semibold">{count.toLocaleString(ar ? "ar" : "en")}</div>
      {percent !== undefined && (
        <div className="mt-1 text-xs text-muted-foreground">{percent.toFixed(1)}%</div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={{ ar: "معدل التحويل", en: "Conversion" }}
        description={{ ar: "آخر 30 يوماً", en: "Last 30 days" }}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Step icon={ShoppingCart} label={ar ? "السلال" : "Carts"} count={data.carts} />
        <Step icon={CreditCard} label={ar ? "الوصول للدفع" : "Reached checkout"} count={data.checkouts} percent={cartToCheckout} />
        <Step icon={CheckCircle2} label={ar ? "تم الدفع" : "Paid"} count={data.paid} percent={checkoutToPaid} />
      </div>
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />
          {ar ? "معدل التحويل الإجمالي" : "Overall conversion rate"}
        </div>
        <div className="text-3xl font-semibold text-primary">{overall.toFixed(2)}%</div>
        <div className="mt-3">
          <Link to="/admin/abandoned" className="text-xs text-primary hover:underline">
            {ar ? "عرض السلال المتروكة →" : "View abandoned carts →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
