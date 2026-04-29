import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, Truck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/track-order")({
  component: TrackPage,
  head: () =>
    buildMeta({
      title: "تتبع الطلب — Maisonnét",
      description:
        "تتبع حالة طلبك من Maisonnét دون الحاجة لتسجيل الدخول — أدخل رقم الطلب والبريد الإلكتروني.",
      path: "/track-order",
      noindex: true,
    }),
});

const schema = z.object({
  order_number: z.string().trim().min(3).max(50),
  email: z.string().trim().email().max(255),
});

function TrackPage() {
  const [orderNum, setOrderNum] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setOrder(null);
    const parsed = schema.safeParse({ order_number: orderNum, email });
    if (!parsed.success) { setError("تحقق من رقم الطلب والبريد"); return; }
    setBusy(true);
    const { data } = await supabase.from("orders").select("order_number,status,payment_status,shipping_status,tracking_number,tracking_url,shipping_carrier,total,currency,created_at,customer_name").eq("order_number", parsed.data.order_number).eq("customer_email", parsed.data.email).maybeSingle();
    setBusy(false);
    if (!data) { setError("لم نجد طلباً مطابقاً. تأكد من البيانات."); return; }
    setOrder(data);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8" dir="rtl">
      <div className="mb-6 text-center">
        <Package className="mx-auto mb-2 h-10 w-10 text-primary" />
        <h1 className="text-2xl font-semibold">تتبع الطلب</h1>
        <p className="mt-1 text-sm text-muted-foreground">أدخل رقم الطلب والبريد الإلكتروني لمتابعة حالة طلبك</p>
      </div>

      <form onSubmit={search} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div>
          <label className="mb-1 block text-xs font-medium">رقم الطلب</label>
          <input value={orderNum} onChange={(e) => setOrderNum(e.target.value)} placeholder="MN-XXXXXX-XXXX" maxLength={50} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">البريد الإلكتروني</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
        </div>
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Search className="h-4 w-4" />{busy ? "جاري البحث..." : "تتبع"}
        </button>
        {error && <p className="text-center text-xs text-red-500">{error}</p>}
      </form>

      {order && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="text-xs text-muted-foreground">رقم الطلب</p>
              <p className="font-semibold">{order.order_number}</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">الإجمالي</p>
              <p className="font-semibold">{Number(order.total).toFixed(2)} {order.currency}</p>
            </div>
          </div>

          <Step icon={CheckCircle2} title="تم استلام الطلب" date={new Date(order.created_at).toLocaleString("ar")} done />
          <Step icon={Clock} title="حالة الدفع" date={order.payment_status} done={order.payment_status === "paid"} />
          <Step icon={Package} title="حالة الطلب" date={order.status} done={["confirmed","shipped","delivered"].includes(order.status)} />
          <Step icon={Truck} title="حالة الشحن" date={order.shipping_status} done={["shipped","in_transit","delivered"].includes(order.shipping_status)} />
          <Step icon={CheckCircle2} title="تم التسليم" date={order.status === "delivered" ? "✓" : "—"} done={order.status === "delivered"} />

          {order.tracking_number && (
            <div className="mt-4 rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">رقم التتبع</p>
              <p className="mt-0.5 font-mono text-sm">{order.tracking_number}</p>
              {order.shipping_carrier && <p className="mt-1 text-[11px] text-muted-foreground">عبر: {order.shipping_carrier}</p>}
              {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">تتبع عند شركة الشحن</a>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step({ icon: Icon, title, date, done }: { icon: any; title: string; date: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
        {done ? <Icon className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{date}</p>
      </div>
    </div>
  );
}
