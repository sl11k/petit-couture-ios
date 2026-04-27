import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { StatusBadge } from "./admin";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersPage,
});

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    let q: any = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setOrders(data ?? []);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function openOrder(o: any) {
    setSelected(o);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setItems(data ?? []);
  }

  async function updateStatus(id: string, status: string) {
    await (supabase.from("orders") as any).update({ status }).eq("id", id);
    await load();
    if (selected?.id === id) setSelected({ ...selected, status });
  }

  async function updateTracking(id: string, tracking: string) {
    await supabase.from("orders").update({ tracking_number: tracking }).eq("id", id);
    await load();
    if (selected?.id === id) setSelected({ ...selected, tracking_number: tracking });
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">الطلبات</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">الكل</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">رقم</th>
              <th className="p-3">العميل</th>
              <th className="p-3">الهاتف</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => openOrder(o)}
                className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
              >
                <td className="p-3 font-mono text-xs">{o.order_number}</td>
                <td className="p-3">{o.customer_name}</td>
                <td className="p-3 text-xs">{o.customer_phone}</td>
                <td className="p-3">
                  {Number(o.total).toFixed(2)} {o.currency}
                </td>
                <td className="p-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("ar")}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  لا توجد طلبات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">طلب {selected.order_number}</h2>
                <p className="text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleString("ar")}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Field label="العميل" value={selected.customer_name} />
              <Field label="الهاتف" value={selected.customer_phone} />
              <Field label="الإيميل" value={selected.customer_email} />
              <Field label="طريقة الدفع" value={selected.payment_method} />
            </div>

            <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm">
              <div className="text-xs text-muted-foreground">عنوان الشحن</div>
              <div className="mt-1">
                {Object.values(selected.shipping_address ?? {}).filter(Boolean).join(" — ")}
              </div>
              {selected.shipping_lat && (
                <a
                  href={`https://maps.google.com/?q=${selected.shipping_lat},${selected.shipping_lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary underline"
                >
                  فتح الموقع في الخريطة
                </a>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">المنتجات</div>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                    {it.image_url && (
                      <img src={it.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm">{it.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.size} / {it.color} × {it.qty}
                      </div>
                    </div>
                    <div className="text-sm">{Number(it.line_total).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-1 rounded-md bg-muted/40 p-3 text-sm">
              <Row label="المجموع الفرعي" value={Number(selected.subtotal).toFixed(2)} />
              <Row label="الشحن" value={Number(selected.shipping_fee).toFixed(2)} />
              <Row label="الضريبة" value={Number(selected.tax).toFixed(2)} />
              <Row label="الإجمالي" value={`${Number(selected.total).toFixed(2)} ${selected.currency}`} bold />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <select
                value={selected.status}
                onChange={(e) => updateStatus(selected.id, e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="رقم التتبع"
                defaultValue={selected.tracking_number ?? ""}
                onBlur={(e) => updateTracking(selected.id, e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
