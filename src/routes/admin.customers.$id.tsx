import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = useParams({ from: "/admin/customers/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pRes, oRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("orders").select("id, order_number, total, status, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
      ]);
      setProfile(pRes.data);
      setOrders(oRes.data ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{ar ? "العميل غير موجود" : "Customer not found"}</p>
        <Link to="/admin/customers" className="mt-3 inline-block text-sm text-primary underline">
          {ar ? "العودة" : "Back"}
        </Link>
      </div>
    );
  }

  const Arrow = ar ? ArrowRight : ArrowLeft;
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);

  return (
    <div>
      <Link to="/admin/customers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Arrow className="h-3 w-3" /> {ar ? "العودة" : "Back"}
      </Link>

      <PageHeader title={profile.full_name ?? profile.email ?? "—"} description={profile.email ?? undefined} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{ar ? "البيانات" : "Info"}</h2>
          <div className="space-y-2 text-sm">
            <Row label={ar ? "الاسم" : "Name"} value={profile.full_name} />
            <Row label={ar ? "الإيميل" : "Email"} value={profile.email} />
            <Row label={ar ? "الهاتف" : "Phone"} value={profile.phone} />
            <Row label={ar ? "تاريخ التسجيل" : "Joined"} value={new Date(profile.created_at).toLocaleDateString(ar ? "ar" : "en")} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{ar ? "إحصائيات" : "Stats"}</h2>
          <div className="space-y-2 text-sm">
            <Row label={ar ? "عدد الطلبات" : "Orders"} value={orders.length} />
            <Row label={ar ? "إجمالي الإنفاق" : "Total spent"} value={`${totalSpent.toLocaleString()} ${ar ? "ر.س" : "SAR"}`} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">{ar ? "الطلبات" : "Orders"}</h2>
          {orders.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{ar ? "لا توجد طلبات" : "No orders"}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{ar ? "الرقم" : "#"}</th>
                  <th className="p-2 text-start">{ar ? "الإجمالي" : "Total"}</th>
                  <th className="p-2 text-start">{ar ? "الحالة" : "Status"}</th>
                  <th className="p-2 text-start">{ar ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="p-2 text-xs">
                      <Link to="/admin/orders/$id" params={{ id: o.id }} className="text-primary hover:underline">
                        #{o.order_number}
                      </Link>
                    </td>
                    <td className="p-2 text-xs">{Number(o.total).toLocaleString()} {ar ? "ر.س" : "SAR"}</td>
                    <td className="p-2 text-xs">{o.status}</td>
                    <td className="p-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString(ar ? "ar" : "en")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{value ?? "—"}</span>
    </div>
  );
}
