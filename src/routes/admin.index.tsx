import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ShoppingBag, Package, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

type Stats = { orders: number; products: number; customers: number; revenue: number };

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  icon: typeof ShoppingBag;
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function Dashboard() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [stats, setStats] = useState<Stats>({ orders: 0, products: 0, customers: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ordersRes, productsRes, customersRes, revenueRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total"),
      ]);
      const revenue = (revenueRes.data ?? []).reduce(
        (acc: number, r: any) => acc + Number(r.total ?? 0),
        0,
      );
      setStats({
        orders: ordersRes.count ?? 0,
        products: productsRes.count ?? 0,
        customers: customersRes.count ?? 0,
        revenue,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title={{ ar: "لوحة التحكم", en: "Dashboard" }}
        description={{ ar: "نظرة سريعة على متجرك", en: "Quick overview of your store" }}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={ar ? "الطلبات" : "Orders"}
          value={loading ? "…" : stats.orders.toLocaleString(ar ? "ar" : "en")}
          icon={ShoppingBag}
          href="/admin/orders"
        />
        <StatCard
          label={ar ? "المنتجات" : "Products"}
          value={loading ? "…" : stats.products.toLocaleString(ar ? "ar" : "en")}
          icon={Package}
          href="/admin/products"
        />
        <StatCard
          label={ar ? "العملاء" : "Customers"}
          value={loading ? "…" : stats.customers.toLocaleString(ar ? "ar" : "en")}
          icon={Users}
          href="/admin/customers"
        />
        <StatCard
          label={ar ? "الإيرادات" : "Revenue"}
          value={loading ? "…" : `${stats.revenue.toLocaleString(ar ? "ar" : "en")} ${ar ? "ر.س" : "SAR"}`}
          icon={DollarSign}
        />
      </div>
    </div>
  );
}
