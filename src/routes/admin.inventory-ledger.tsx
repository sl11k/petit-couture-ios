import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Clock, RefreshCw, PackageSearch } from "lucide-react";

type LedgerRow = {
  id: string;
  created_at: string;
  movement_type: "reserved" | "deducted" | "returned" | "released";
  qty: number;
  delta: number;
  order_id: string | null;
  order_number: string | null;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string | null;
  product_name: string | null;
  sku: string | null;
  stock_before: number | null;
  stock_after: number | null;
  order_status: string | null;
  payment_status: string | null;
  payment_event: string | null;
  notes: string | null;
};

const TYPES: { key: string; ar: string; cls: string }[] = [
  { key: "all", ar: "الكل", cls: "" },
  { key: "reserved", ar: "محجوز", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { key: "deducted", ar: "مخصوم", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  { key: "returned", ar: "مُرجع", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { key: "released", ar: "إلغاء حجز", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
];

function typeBadge(t: string) {
  const found = TYPES.find((x) => x.key === t);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${found?.cls || "bg-muted text-muted-foreground"}`}>
      {found?.ar || t}
    </span>
  );
}

function InventoryLedgerPage() {
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inventory-ledger", type],
    queryFn: async () => {
      let q = (supabase as any)
        .from("inventory_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (type !== "all") q = q.eq("movement_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LedgerRow[];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data || [];
    return (data || []).filter((r) =>
      [r.order_number, r.product_name, r.sku, r.order_id, r.payment_event]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [data, search]);

  const stats = useMemo(() => {
    const s = { reserved: 0, deducted: 0, returned: 0, released: 0 };
    for (const r of data || []) s[r.movement_type] = (s[r.movement_type] || 0) + r.qty;
    return s;
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">سجل حركات المخزون</h1>
          <p className="text-sm text-muted-foreground">
            كل عملية حجز أو خصم أو إرجاع مرتبطة برقم الطلب وحدث الدفع للتحقق الكامل.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`me-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="كميات محجوزة" value={stats.reserved} />
        <StatCard icon={<ArrowDownCircle className="h-4 w-4 text-rose-600" />} label="كميات مخصومة" value={stats.deducted} />
        <StatCard icon={<ArrowUpCircle className="h-4 w-4 text-emerald-600" />} label="كميات مُرجعة" value={stats.returned} />
        <StatCard icon={<PackageSearch className="h-4 w-4 text-sky-600" />} label="إلغاء حجز" value={stats.released} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">الحركات ({rows.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {TYPES.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={type === t.key ? "default" : "outline"}
                onClick={() => setType(t.key)}
              >
                {t.ar}
              </Button>
            ))}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب أو المنتج أو SKU"
              className="h-9 w-full md:w-64"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد حركات مطابقة.</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">النوع</th>
                  <th className="p-2 text-start">المنتج</th>
                  <th className="p-2 text-start">الكمية</th>
                  <th className="p-2 text-start">قبل → بعد</th>
                  <th className="p-2 text-start">الطلب</th>
                  <th className="p-2 text-start">حالة الدفع</th>
                  <th className="p-2 text-start">حدث الدفع</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </td>
                    <td className="p-2">{typeBadge(r.movement_type)}</td>
                    <td className="p-2">
                      <div className="font-medium">{r.product_name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.sku || ""}{r.variant_id ? " • مقاس محدد" : ""}
                      </div>
                    </td>
                    <td className="p-2 font-mono">
                      <span className={r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-rose-600" : ""}>
                        {r.delta > 0 ? `+${r.delta}` : r.delta}
                      </span>
                      <span className="text-muted-foreground"> ({r.qty})</span>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {r.stock_before ?? "—"} → {r.stock_after ?? "—"}
                    </td>
                    <td className="p-2">
                      {r.order_id ? (
                        <Link to="/admin/orders/$id" params={{ id: r.order_id }} className="text-primary underline">
                          {r.order_number || r.order_id.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <div className="text-[11px] text-muted-foreground">{r.order_status || ""}</div>
                    </td>
                    <td className="p-2">
                      <Badge variant={r.payment_status === "paid" ? "default" : "secondary"}>
                        {r.payment_status || "—"}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      <div>{r.payment_event || "—"}</div>
                      <div>{r.notes || ""}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/admin/inventory-ledger")({
  head: () => ({
    meta: [
      { title: "سجل حركات المخزون | لوحة التحكم" },
      { name: "description", content: "تتبع كل حركة حجز أو خصم أو إرجاع للمخزون مرتبطة بالطلب وحدث الدفع." },
      { property: "og:title", content: "سجل حركات المخزون" },
      { property: "og:description", content: "تتبع كل حركة مخزون مرتبطة برقم الطلب وحالة الدفع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryLedgerPage,
});
