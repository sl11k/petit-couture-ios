import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, Package, Truck, Home, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { db } from "@/lib/db";

type OrderItem = {
  id: string;
  product_name: string;
  brand: string | null;
  qty: number;
  size: string | null;
  color: string | null;
  unit_price: number;
  line_total: number;
  image_url: string | null;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
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

export const Route = createFileRoute("/order-confirmation/$orderNumber")({
  loader: async ({ params }) => {
    const { data, error } = await db
      .from("orders")
      .select(
        "id, order_number, status, customer_name, customer_email, customer_phone, subtotal, shipping_fee, tax, total, currency, shipping_address, created_at, order_items(id, product_name, brand, qty, size, color, unit_price, line_total, image_url)",
      )
      .eq("order_number", params.orderNumber)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { order: data as Order };
  },
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderNumber} — Le Petit Paradis` },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-cream px-6 text-center">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Order not found</h1>
        <Link to="/" className="mt-4 inline-block text-gold-deep underline">
          Return home
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-cream px-6 text-center">
      <div>
        <p className="text-destructive">{error.message}</p>
        <Link to="/" className="mt-4 inline-block text-gold-deep underline">
          Return home
        </Link>
      </div>
    </div>
  ),
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
  const { order } = Route.useLoaderData();
  const { lang, isRTL } = useLanguage();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const fmt = (n: number) => n.toLocaleString(locale);

  const placedAt = new Date(order.created_at);
  const shipBy = new Date(placedAt.getTime() + 1000 * 60 * 60 * 24 * 2); // +2 days
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

  const t = {
    eyebrow: lang === "ar" ? "تم التأكيد" : "ORDER CONFIRMED",
    thankyou: lang === "ar" ? "شكراً لطلبك" : "Thank you for your order",
    sub:
      lang === "ar"
        ? "أرسلنا تأكيداً إلى بريدك الإلكتروني مع تفاصيل التتبع."
        : "We've sent a confirmation to your email with tracking details.",
    orderNo: lang === "ar" ? "رقم الطلب" : "Order number",
    timeline: lang === "ar" ? "الجدول الزمني للتسليم" : "Delivery timeline",
    placed: lang === "ar" ? "تم استلام الطلب" : "Order placed",
    processing: lang === "ar" ? "تجهيز وشحن" : "Preparing & shipping",
    delivery: lang === "ar" ? "التوصيل المتوقع" : "Expected delivery",
    summary: lang === "ar" ? "ملخص الطلب" : "Order summary",
    subtotal: lang === "ar" ? "المجموع الفرعي" : "Subtotal",
    shipping: lang === "ar" ? "الشحن" : "Shipping",
    tax: lang === "ar" ? "الضريبة (15%)" : "VAT (15%)",
    total: lang === "ar" ? "الإجمالي" : "Total",
    address: lang === "ar" ? "عنوان التسليم" : "Delivery address",
    cta: lang === "ar" ? "متابعة التسوق" : "Continue shopping",
    qty: lang === "ar" ? "الكمية" : "Qty",
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen w-full bg-cream flex justify-center"
    >
      <div className="relative w-full max-w-[480px] bg-background min-h-screen shadow-soft pb-24">
        {/* Hero */}
        <header className="px-6 pt-12 pb-8 text-center">
          <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-gold-deep/10">
            <CheckCircle2
              className="h-9 w-9 text-gold-deep"
              strokeWidth={1.6}
            />
          </div>
          <p className="mt-5 text-[10.5px] tracking-luxury text-gold-deep">
            {t.eyebrow}
          </p>
          <h1 className="mt-2 font-serif text-[28px] leading-tight text-foreground">
            {t.thankyou}
          </h1>
          <p className="mt-2 text-[12.5px] text-muted-foreground tracking-soft px-4">
            {t.sub}
          </p>

          <div className="mt-6 inline-flex flex-col items-center px-5 py-3 rounded-[16px] border border-gold-soft bg-cream-warm/40">
            <span className="text-[10px] tracking-luxury text-muted-foreground">
              {t.orderNo}
            </span>
            <span className="mt-1 font-serif text-[18px] tabular-nums text-foreground">
              {order.order_number}
            </span>
          </div>
        </header>

        {/* Timeline */}
        <section className="px-6 mt-2">
          <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-4">
            {t.timeline}
          </h2>
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

        {/* Items */}
        <section className="px-6 mt-8">
          <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-4">
            {t.summary}
          </h2>
          <ul className="space-y-3">
            {order.order_items.map((it: any) => (
              <li
                key={it.id}
                className="flex gap-3 p-3 rounded-[14px] border border-border bg-cream-warm/20"
              >
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.product_name}
                    className="h-16 w-16 rounded-[10px] object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-[10px] bg-cream-warm" />
                )}
                <div className="flex-1 min-w-0">
                  {it.brand && (
                    <p className="text-[10px] tracking-luxury text-muted-foreground">
                      {it.brand}
                    </p>
                  )}
                  <p className="text-[13px] text-foreground truncate">
                    {it.product_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground tracking-soft mt-0.5">
                    {[it.size, it.color].filter(Boolean).join(" · ")}
                    {it.size || it.color ? " · " : ""}
                    {t.qty} {fmt(it.qty)}
                  </p>
                </div>
                <span className="text-[13px] tabular-nums text-foreground self-start">
                  {fmt(it.line_total)} {order.currency}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Totals */}
        <section className="px-6 mt-6">
          <div className="rounded-[16px] border border-border bg-background p-4 space-y-2 text-[13px]">
            <Row label={t.subtotal} value={`${fmt(order.subtotal)} ${order.currency}`} />
            <Row
              label={t.shipping}
              value={
                order.shipping_fee === 0
                  ? lang === "ar"
                    ? "مجاني"
                    : "Free"
                  : `${fmt(order.shipping_fee)} ${order.currency}`
              }
            />
            <Row label={t.tax} value={`${fmt(order.tax)} ${order.currency}`} />
            <div className="h-px bg-border my-1" />
            <Row
              label={t.total}
              value={`${fmt(order.total)} ${order.currency}`}
              bold
            />
          </div>
        </section>

        {/* Address */}
        <section className="px-6 mt-6">
          <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-3">
            {t.address}
          </h2>
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
                <p className="mt-1 text-[11px] tracking-luxury text-muted-foreground">
                  {addr.shortCode}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* CTA */}
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
        <p className="text-[11.5px] text-muted-foreground tracking-soft mt-0.5">
          {detail}
        </p>
      </div>
    </li>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "text-foreground font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={[
          "tabular-nums",
          bold ? "text-foreground font-medium" : "text-foreground",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
