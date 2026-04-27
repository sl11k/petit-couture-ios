import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin")({
  component: AdminHome,
});

type Stats = {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  abandonedCarts: number;
  visits7d: number;
  conversion: number;
};

function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [ordersAll, ordersPending, ordersRev, custs, prods, carts, visits, recents] =
        await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("orders").select("total").neq("status", "cancelled"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("converted", false),
          supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("event_name", "page_view")
            .gte("created_at", since),
          supabase
            .from("orders")
            .select("id, order_number, customer_name, total, currency, status, created_at")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

      const revenue = (ordersRev.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
      const visitsCount = visits.count ?? 0;
      const ordersCount = ordersAll.count ?? 0;
      const conversion = visitsCount > 0 ? (ordersCount / visitsCount) * 100 : 0;

      setStats({
        totalOrders: ordersCount,
        pendingOrders: ordersPending.count ?? 0,
        totalRevenue: revenue,
        totalCustomers: custs.count ?? 0,
        totalProducts: prods.count ?? 0,
        abandonedCarts: carts.count ?? 0,
        visits7d: visitsCount,
        conversion,
      });
      setRecentOrders(recents.data ?? []);
    })();
  }, []);

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold text-foreground">نظرة عامة</h1>
      <p className="mt-1 text-sm text-muted-foreground">آخر 7 أيام</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="إجمالي الطلبات" value={stats?.totalOrders ?? "—"} />
        <Stat label="طلبات معلقة" value={stats?.pendingOrders ?? "—"} accent />
        <Stat
          label="إجمالي المبيعات"
          value={stats ? `${stats.totalRevenue.toFixed(0)} SAR` : "—"}
        />
        <Stat label="العملاء" value={stats?.totalCustomers ?? "—"} />
        <Stat label="المنتجات" value={stats?.totalProducts ?? "—"} />
        <Stat label="سلات مهجورة" value={stats?.abandonedCarts ?? "—"} />
        <Stat label="الزيارات" value={stats?.visits7d ?? "—"} />
        <Stat
          label="معدل التحويل"
          value={stats ? `${stats.conversion.toFixed(1)}%` : "—"}
        />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-base font-semibold text-foreground">آخر الطلبات</h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">رقم الطلب</th>
                  <th className="py-2 pr-4">العميل</th>
                  <th className="py-2 pr-4">المبلغ</th>
                  <th className="py-2 pr-4">الحالة</th>
                  <th className="py-2">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{o.order_number}</td>
                    <td className="py-2 pr-4">{o.customer_name}</td>
                    <td className="py-2 pr-4">
                      {Number(o.total).toFixed(2)} {o.currency}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("ar")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    processing: "bg-indigo-100 text-indigo-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  };
  const labels: Record<string, string> = {
    pending: "معلق",
    paid: "مدفوع",
    processing: "قيد التجهيز",
    shipped: "تم الشحن",
    delivered: "تم التوصيل",
    cancelled: "ملغي",
    refunded: "مسترد",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100"}`}>
      {labels[status] ?? status}
    </span>
  );
}
