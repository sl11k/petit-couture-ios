import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetailPage,
});

const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "failed"];

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value ?? "—"}</div>
    </div>
  );
}

function OrderDetailPage() {
  const { id } = useParams({ from: "/admin/orders/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [oRes, iRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id),
      ]);
      const o = oRes.data;
      setOrder(o);
      setItems(iRes.data ?? []);
      if (o) {
        setStatus(o.status ?? "");
        setPaymentStatus(o.payment_status ?? "");
        setTrackingNumber(o.tracking_number ?? "");
        setNotes(o.notes ?? "");
      }
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: status as any,
        payment_status: paymentStatus,
        tracking_number: trackingNumber || null,
        notes: notes || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) alert(error.message);
    else {
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      setOrder(data);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  }
  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{ar ? "الطلب غير موجود" : "Order not found"}</p>
        <Link to="/admin/orders" className="mt-3 inline-block text-sm text-primary underline">
          {ar ? "العودة للطلبات" : "Back to orders"}
        </Link>
      </div>
    );
  }

  const Arrow = ar ? ArrowRight : ArrowLeft;
  const addr = order.shipping_address ?? {};

  return (
    <div>
      <Link to="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Arrow className="h-3 w-3" /> {ar ? "العودة للطلبات" : "Back to orders"}
      </Link>

      <PageHeader
        title={`#${order.order_number}`}
        description={{
          ar: `${order.customer_name} • ${new Date(order.created_at).toLocaleString("ar")}`,
          en: `${order.customer_name} • ${new Date(order.created_at).toLocaleString("en")}`,
        }}
        actions={
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> {saving ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ التغييرات" : "Save changes"}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status & actions */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "حالة الطلب" : "Order status"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] text-muted-foreground">{ar ? "الحالة" : "Status"}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">{ar ? "حالة الدفع" : "Payment status"}</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">{ar ? "رقم التتبع" : "Tracking #"}</label>
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">{ar ? "ملاحظات" : "Notes"}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border p-4 text-sm font-semibold">{ar ? "المنتجات" : "Items"}</h2>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{ar ? "المنتج" : "Product"}</th>
                  <th className="p-3 text-start">{ar ? "الكمية" : "Qty"}</th>
                  <th className="p-3 text-start">{ar ? "السعر" : "Price"}</th>
                  <th className="p-3 text-start">{ar ? "الإجمالي" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 text-xs">{it.product_name ?? it.name ?? "—"}</td>
                    <td className="p-3 text-xs">{it.quantity}</td>
                    <td className="p-3 text-xs">{Number(it.price).toLocaleString()} {ar ? "ر.س" : "SAR"}</td>
                    <td className="p-3 text-xs font-medium">
                      {(Number(it.price) * Number(it.quantity)).toLocaleString()} {ar ? "ر.س" : "SAR"}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">
                      {ar ? "لا توجد عناصر" : "No items"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-border p-4">
              <div className="ms-auto max-w-xs space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "المجموع الفرعي" : "Subtotal"}</span><span>{Number(order.subtotal).toLocaleString()} {ar ? "ر.س" : "SAR"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "الشحن" : "Shipping"}</span><span>{Number(order.shipping_fee).toLocaleString()} {ar ? "ر.س" : "SAR"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? "الضريبة" : "Tax"}</span><span>{Number(order.tax).toLocaleString()} {ar ? "ر.س" : "SAR"}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>{ar ? "الإجمالي" : "Total"}</span><span>{Number(order.total).toLocaleString()} {ar ? "ر.س" : "SAR"}</span></div>
              </div>
            </div>
          </section>
        </div>

        {/* Customer & shipping */}
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "العميل" : "Customer"}</h2>
            <div className="space-y-3">
              <Field label={ar ? "الاسم" : "Name"} value={order.customer_name} />
              <Field label={ar ? "الإيميل" : "Email"} value={order.customer_email} />
              <Field label={ar ? "الهاتف" : "Phone"} value={order.customer_phone} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "العنوان" : "Address"}</h2>
            <div className="space-y-1 text-xs">
              {addr.line1 && <div>{addr.line1}</div>}
              {addr.line2 && <div>{addr.line2}</div>}
              {(addr.city || addr.region) && <div>{[addr.city, addr.region].filter(Boolean).join(", ")}</div>}
              {addr.country && <div>{addr.country}</div>}
              {Object.keys(addr).length === 0 && <div className="text-muted-foreground">—</div>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{ar ? "الحالة الحالية" : "Current state"}</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{ar ? "الطلب" : "Order"}</span>
                <StatusBadge value={order.status} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{ar ? "الدفع" : "Payment"}</span>
                <StatusBadge value={order.payment_status} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{ar ? "الشحن" : "Shipping"}</span>
                <StatusBadge value={order.shipping_status} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{ar ? "الدفع" : "Method"}</span>
                <span>{order.payment_method}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
