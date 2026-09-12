import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Package, Truck, Home, MapPin, Copy, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { pixelTrack, setPixelUser } from "@/lib/pixels";
import { stableMetaEventId } from "@/lib/meta-events";
import { getOrderConfirmation } from "@/lib/orderConfirmation.functions";
import { finalizeStripeOrder } from "@/lib/stripeFinalize.functions";
import { reconcileReturnedPayment } from "@/lib/deferred-payment.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrderItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  brand: string | null;
  qty: number;
  size: string | null;
  color: string | null;
  sku: string | null;
  unit_price: number;
  line_total: number;
  image_url: string | null;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_gateway: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  shipping_fee: number;
  tax: number;
  total: number;
  currency: string;
  shipping_address: Record<string, unknown>;
  created_at: string;
  order_items: OrderItem[];
};

const SESSION_KEY = "maisonnet:session_id:v1";

function readSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/order-confirmation/$orderNumber")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderNumber} — Le Petit Paradis` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderConfirmationPage,
});

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function OrderConfirmationPage() {
  const { orderNumber } = Route.useParams();
  const { lang, isRTL } = useLanguage();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const fmt = (n: number) => n.toLocaleString(locale);

  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "waiting_payment" | "ready" | "not_found" | "forbidden">("loading");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // ~40s
    const intervalMs = 2000;
    const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const stripeReturn = url?.searchParams.get("stripe") === "success";
    const stripeSessionId = url?.searchParams.get("session_id") || null;
    const isPaymentReturn = !!url && /[?&](stripe|tabby|tamara)=/.test(url.search);

    // Best-effort: proactively finalize the Stripe order in case the
    // webhook hasn't landed yet. Safe to call repeatedly; RPC is idempotent.
    if (stripeReturn && stripeSessionId) {
      void finalizeStripeOrder({
        data: { order_number: orderNumber, stripe_session_id: stripeSessionId },
      }).catch((err) => console.warn("[order-confirmation] finalize failed", err));
    }
    if (url?.searchParams.get("tabby") === "success" || url?.searchParams.get("tamara") === "success") {
      void reconcileReturnedPayment({ data: { order_number: orderNumber } }).catch((err) =>
        console.warn("[order-confirmation] deferred payment reconciliation failed", err),
      );
    }

    async function poll() {
      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        try {
          const session_id = readSessionId();
          const { data: authData } = await supabase.auth.getSession();
          const auth_token = authData.session?.access_token ?? null;
          const result = await getOrderConfirmation({
            data: { order_number: orderNumber, session_id, auth_token },
          });
          if (cancelled) return;
          if (!result.ok) {
            if (result.reason === "not_found" && attempts < 5) {
              await new Promise((r) => setTimeout(r, intervalMs));
              continue;
            }
            setState(result.reason);
            return;
          }
          const o = result.order as Order;
          setOrder(o);
          // If returning from an online gateway, wait for webhook to mark it paid.
          const needsPayment =
            isPaymentReturn &&
            o.payment_method !== "cod" &&
            o.payment_status !== "paid" &&
            o.payment_status !== "refunded";
          if (needsPayment && attempts < maxAttempts) {
            setState("waiting_payment");
            await new Promise((r) => setTimeout(r, intervalMs));
            continue;
          }
          setState("ready");
          return;
        } catch (err) {
          console.error("[order-confirmation] poll error", err);
          if (attempts < 5) {
            await new Promise((r) => setTimeout(r, intervalMs));
            continue;
          }
          setState("not_found");
          return;
        }
      }
      if (!cancelled) setState(order ? "ready" : "not_found");
    }
    void poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  const pixelFired = useRef(false);
  useEffect(() => {
    if (state === "ready" && order && ["paid", "captured", "succeeded"].includes(order.payment_status) && !pixelFired.current) {
      pixelFired.current = true;
      setPixelUser({ email: order.customer_email, phone: order.customer_phone });
      // Purchase value is the real amount charged for THIS order (items +
      // shipping + tax − discounts), never a fixed placeholder.
      const items = order.order_items ?? [];
      pixelTrack("Purchase", {
        value: Number(order.total) || 0,
        currency: order.currency,
        order_id: order.order_number,
        content_type: "product",
        quantity: items.reduce((sum, i) => sum + (Number(i.qty) || 1), 0) || 1,
        contents: items.map((i) => ({
          id: i.variant_id || i.product_id || i.sku || i.id,
          quantity: Number(i.qty) || 1,
          price: Number(i.unit_price) || 0,
        })),
        event_id: stableMetaEventId("Purchase", order.id),
      });
    }
  }, [state, order]);

  if (state === "loading" || (state === "waiting_payment" && !order)) {
    return (
      <div className="min-h-screen grid place-items-center bg-cream px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold-deep" />
          <p className="text-[13px] text-muted-foreground">
            {lang === "ar" ? "جارٍ تأكيد طلبك..." : "Confirming your order..."}
          </p>
        </div>
      </div>
    );
  }

  if (state === "not_found" || state === "forbidden" || !order) {
    return (
      <div className="min-h-screen grid place-items-center bg-cream px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl text-foreground">
            {lang === "ar" ? "الطلب غير موجود" : "Order not found"}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {lang === "ar"
              ? "لم نتمكن من العثور على هذا الطلب. إذا أكملت الدفع للتو، انتظر لحظة وحدّث الصفحة."
              : "We couldn't find this order. If you just completed payment, wait a moment and refresh."}
          </p>
          <Link to="/" className="mt-4 inline-block text-gold-deep underline">
            {lang === "ar" ? "الصفحة الرئيسية" : "Return home"}
          </Link>
        </div>
      </div>
    );
  }

  const placedAt = new Date(order.created_at);
  const shipBy = new Date(placedAt.getTime() + 1000 * 60 * 60 * 24 * 2);
  const deliverFrom = new Date(placedAt.getTime() + 1000 * 60 * 60 * 24 * 3);
  const deliverTo = new Date(placedAt.getTime() + 1000 * 60 * 60 * 24 * 5);

  const addr = order.shipping_address as {
    fullName?: string;
    street?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    shortCode?: string;
    buildingNumber?: string;
  };

  const isPaid = order.payment_status === "paid";
  const waitingPayment = state === "waiting_payment";

  const t = {
    eyebrow: lang === "ar" ? "تم استلام الطلب" : "ORDER RECEIVED",
    thankyou: lang === "ar" ? "شكراً لطلبك" : "Thank you for your order",
    sub:
      lang === "ar"
        ? "أرسلنا تأكيداً إلى بريدك الإلكتروني مع تفاصيل التتبع."
        : "We've sent a confirmation to your email with tracking details.",
    orderNo: lang === "ar" ? "رقم الطلب" : "Order number",
    copyOk: lang === "ar" ? "تم نسخ رقم الطلب" : "Order number copied",
    paidBadge: lang === "ar" ? "تم الدفع" : "Paid",
    waitingBadge:
      lang === "ar" ? "بانتظار تأكيد الدفع..." : "Waiting for payment confirmation...",
    timeline: lang === "ar" ? "الجدول الزمني للتسليم" : "Delivery timeline",
    placed: lang === "ar" ? "تم استلام الطلب" : "Order placed",
    processing: lang === "ar" ? "تجهيز وشحن" : "Preparing & shipping",
    delivery: lang === "ar" ? "التوصيل المتوقع" : "Expected delivery",
    summary: lang === "ar" ? "ملخص الطلب" : "Order summary",
    subtotal: lang === "ar" ? "المجموع الفرعي" : "Subtotal",
    shipping: lang === "ar" ? "الشحن" : "Shipping",
    tax: lang === "ar" ? "الضريبة" : "VAT",
    total: lang === "ar" ? "الإجمالي" : "Total",
    address: lang === "ar" ? "عنوان التسليم" : "Delivery address",
    cta: lang === "ar" ? "متابعة التسوق" : "Continue shopping",
    qty: lang === "ar" ? "الكمية" : "Qty",
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[480px] bg-background min-h-screen shadow-soft pb-24">
        <header className="px-6 pt-12 pb-8 text-center">
          <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-gold-deep/10">
            <CheckCircle2 className="h-9 w-9 text-gold-deep" strokeWidth={1.6} />
          </div>
          <p className="mt-5 text-[10.5px] tracking-luxury text-gold-deep">{t.eyebrow}</p>
          <h1 className="mt-2 font-serif text-[28px] leading-tight text-foreground">
            {t.thankyou}
          </h1>
          <p className="mt-2 text-[12.5px] text-muted-foreground tracking-soft px-4">{t.sub}</p>

          <div className="mt-6 inline-flex flex-col items-center px-5 py-3 rounded-[16px] border border-gold-soft bg-cream-warm/40">
            <span className="text-[10px] tracking-luxury text-muted-foreground">{t.orderNo}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(order.order_number).then(
                  () => toast.success(t.copyOk),
                  () => {},
                );
              }}
              className="mt-1 inline-flex items-center gap-2 font-serif text-[18px] tabular-nums text-foreground hover:text-gold-deep transition"
            >
              {order.order_number}
              <Copy className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
            {isPaid && (
              <span className="mt-2 text-[10px] tracking-luxury text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {t.paidBadge}
              </span>
            )}
            {waitingPayment && (
              <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] tracking-luxury text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t.waitingBadge}
              </span>
            )}
          </div>
        </header>

        <section className="px-6 mt-2">
          <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-4">{t.timeline}</h2>
          <ol className="space-y-4">
            <TimelineRow
              icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.7} />}
              label={t.placed}
              detail={formatDate(placedAt, locale)}
              done
            />
            <TimelineRow
              icon={<Package className="h-4 w-4" strokeWidth={1.7} />}
              label={t.processing}
              detail={`${formatDate(placedAt, locale)} – ${formatDate(shipBy, locale)}`}
            />
            <TimelineRow
              icon={<Truck className="h-4 w-4" strokeWidth={1.7} />}
              label={t.delivery}
              detail={`${formatDate(deliverFrom, locale)} – ${formatDate(deliverTo, locale)}`}
              accent
            />
          </ol>
        </section>

        <section className="px-6 mt-8">
          <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-4">{t.summary}</h2>
          <ul className="space-y-3">
            {order.order_items.map((it) => (
              <li key={it.id} className="flex gap-3 p-3 rounded-[14px] border border-border bg-cream-warm/20">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.product_name} className="h-16 w-16 rounded-[10px] object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-[10px] bg-cream-warm" />
                )}
                <div className="flex-1 min-w-0">
                  {it.brand && (
                    <p className="text-[10px] tracking-luxury text-muted-foreground">{it.brand}</p>
                  )}
                  <p className="text-[13px] text-foreground truncate">{it.product_name}</p>
                  <p className="text-[11px] text-muted-foreground tracking-soft mt-0.5">
                    {[it.size, it.color].filter(Boolean).join(" · ")}
                    {it.size || it.color ? " · " : ""}
                    {t.qty} {fmt(it.qty)}
                  </p>
                  {it.sku && (
                    <p className="text-[10.5px] text-muted-foreground/80 font-mono mt-0.5" dir="ltr">
                      SKU: {it.sku}
                    </p>
                  )}
                </div>
                <span className="text-[13px] tabular-nums text-foreground self-start">
                  {fmt(it.line_total)} {order.currency}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="px-6 mt-6">
          <div className="rounded-[16px] border border-border bg-background p-4 space-y-2 text-[13px]">
            <Row label={t.subtotal} value={`${fmt(order.subtotal)} ${order.currency}`} />
            <Row
              label={t.shipping}
              value={
                order.shipping_fee === 0
                  ? lang === "ar" ? "مجاني" : "Free"
                  : `${fmt(order.shipping_fee)} ${order.currency}`
              }
            />
            <Row label={t.tax} value={`${fmt(order.tax)} ${order.currency}`} />
            <div className="h-px bg-border my-1" />
            <Row label={t.total} value={`${fmt(order.total)} ${order.currency}`} bold />
          </div>
        </section>

        <section className="px-6 mt-6">
          <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-3">{t.address}</h2>
          <div className="rounded-[16px] border border-border p-4 flex gap-3">
            <MapPin className="h-4 w-4 text-gold-deep shrink-0 mt-0.5" strokeWidth={1.7} />
            <div className="text-[12.5px] text-foreground tracking-soft leading-relaxed">
              <p className="font-medium">{addr?.fullName ?? order.customer_name}</p>
              <p className="text-muted-foreground">
                {[addr?.buildingNumber, addr?.street, addr?.district, addr?.city, addr?.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {addr?.shortCode && (
                <p className="mt-1 text-[11px] tracking-luxury text-muted-foreground">{addr.shortCode}</p>
              )}
            </div>
          </div>
        </section>

        <div className="px-6 mt-8">
          <Link
            to="/"
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background text-[12px] tracking-luxury active:scale-[0.99] transition"
          >
            <Home className="h-4 w-4" strokeWidth={1.7} />
            {t.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  icon,
  label,
  detail,
  done,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  done?: boolean;
  accent?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={[
          "h-8 w-8 grid place-items-center rounded-full shrink-0",
          done
            ? "bg-gold-deep text-background"
            : accent
              ? "bg-foreground text-background"
              : "bg-cream-warm text-muted-foreground border border-border",
        ].join(" ")}
      >
        {icon}
      </span>
      <div className="flex-1 pt-1">
        <p className="text-[13px] text-foreground">{label}</p>
        <p className="text-[11.5px] text-muted-foreground tracking-soft mt-0.5">{detail}</p>
      </div>
    </li>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "text-foreground font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={["tabular-nums", bold ? "text-foreground font-medium" : "text-foreground"].join(" ")}>
        {value}
      </span>
    </div>
  );
}
