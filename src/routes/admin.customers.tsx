import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orderTotals, setOrderTotals] = useState<Record<string, { count: number; total: number }>>({});

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      setCustomers(profiles ?? []);

      const { data: orders } = await supabase
        .from("orders")
        .select("user_id, total")
        .neq("status", "cancelled");
      const map: Record<string, { count: number; total: number }> = {};
      (orders ?? []).forEach((o) => {
        if (!o.user_id) return;
        if (!map[o.user_id]) map[o.user_id] = { count: 0, total: 0 };
        map[o.user_id].count++;
        map[o.user_id].total += Number(o.total ?? 0);
      });
      setOrderTotals(map);
    })();
  }, []);

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold">العملاء</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">الاسم</th>
              <th className="p-3">الإيميل</th>
              <th className="p-3">الهاتف</th>
              <th className="p-3">عدد الطلبات</th>
              <th className="p-3">الإجمالي</th>
              <th className="p-3">تاريخ التسجيل</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const stats = orderTotals[c.user_id] ?? { count: 0, total: 0 };
              return (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="p-3">{c.full_name || "—"}</td>
                  <td className="p-3 text-xs">{c.email}</td>
                  <td className="p-3 text-xs">{c.phone || "—"}</td>
                  <td className="p-3">{stats.count}</td>
                  <td className="p-3">{stats.total.toFixed(2)} SAR</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("ar")}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  لا يوجد عملاء بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
