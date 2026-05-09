import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/states")({
  component: StatesPage,
});

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["unpaid", "pending_review", "paid", "failed", "refunded", "expired"];

function StatesPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [data, setData] = useState<{ status: Record<string, number>; payment: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const status: Record<string, number> = {};
      const payment: Record<string, number> = {};
      await Promise.all([
        ...ORDER_STATUSES.map(async (s) => {
          const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", s as any);
          status[s] = count ?? 0;
        }),
        ...PAYMENT_STATUSES.map(async (s) => {
          const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", s as any);
          payment[s] = count ?? 0;
        }),
      ]);
      setData({ status, payment });
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const Card = ({ entries }: { entries: [string, number][] }) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([k, v]) => (
        <Link
          key={k}
          to="/admin/orders"
          className="rounded-md border border-border bg-card p-3 text-center transition hover:border-primary/50 hover:bg-muted"
        >
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
          <div className="mt-1 text-xl font-semibold">{v.toLocaleString(ar ? "ar" : "en")}</div>
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={{ ar: "حالات الطلبات", en: "Order States" }}
        description={{ ar: "نظرة سريعة على كل حالة", en: "Quick view across all statuses" }}
      />
      <div className="mb-2 mt-2 text-sm font-medium">{ar ? "حالة الطلب" : "Order status"}</div>
      <Card entries={ORDER_STATUSES.map((s) => [s, data.status[s] ?? 0])} />
      <div className="mb-2 mt-6 text-sm font-medium">{ar ? "حالة الدفع" : "Payment status"}</div>
      <Card entries={PAYMENT_STATUSES.map((s) => [s, data.payment[s] ?? 0])} />
    </div>
  );
}
