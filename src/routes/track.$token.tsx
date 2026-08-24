import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicTracking } from "@/lib/tracking.functions";
import { buildMeta } from "@/lib/seo";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/track/$token")({
  component: LiveTrackPage,
  head: () =>
    buildMeta({
      title: "تتبع شحنتك مباشرة — Le Petit Paradis",
      description: "تابع حالة شحنتك لحظة بلحظة: رقم التتبع، مراحل الشحن، والموعد المتوقع للتسليم.",
      path: "/track",
      noindex: true,
    }),
});

type Tracking = {
  order_number: string;
  status: string;
  payment_status: string;
  shipping_status: string | null;
  tracking_number: string | null;
  carrier_tracking_url: string | null;
  carrier: string | null;
  total: number;
  currency: string;
  created_at: string;
  customer_name: string | null;
  city: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery_at: string | null;
  events: { status: string; description: string | null; location: string | null; occurred_at: string }[];
  items: { name: string; qty: number; image: string | null }[];
};

const STAGES = [
  { key: "confirmed", label: "تم تأكيد الطلب", icon: CheckCircle2 },
  { key: "processing", label: "قيد التجهيز", icon: Package },
  { key: "shipped", label: "تم الشحن", icon: PackageCheck },
  { key: "in_transit", label: "في الطريق إليك", icon: Truck },
  { key: "out_for_delivery", label: "خارج للتسليم", icon: MapPin },
  { key: "delivered", label: "تم التسليم", icon: CheckCircle2 },
];

const ORDER_INDEX: Record<string, number> = {
  pending: 0,
  confirmed: 0,
  paid: 0,
  processing: 1,
  ready_to_ship: 1,
  picked_up: 2,
  shipped: 2,
  in_transit: 3,
  out_for_delivery: 4,
  delivered: 5,
};

const LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  confirmed: "تم التأكيد",
  processing: "قيد التجهيز",
  ready_to_ship: "جاهز للشحن",
  picked_up: "استلمتها شركة الشحن",
  shipped: "تم الشحن",
  in_transit: "في الطريق إليك",
  out_for_delivery: "خارج للتسليم",
  delivered: "تم التسليم",
  returned: "مرتجع",
  failed: "تعذر التسليم",
  cancelled: "ملغي",
};

function fmt(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function LiveTrackPage() {
  const { token } = Route.useParams();
  const fetchTracking = useServerFn(getPublicTracking);
  const [data, setData] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      try {
        const res: any = await fetchTracking({ data: { token } });
        if (!mounted.current) return;
        if (!res?.ok) {
          setError("لم نتمكن من العثور على هذه الشحنة. تأكد من الرابط.");
        } else {
          setError("");
          setData(res.tracking as Tracking);
          setUpdatedAt(new Date());
        }
      } catch {
        if (mounted.current) setError("تعذر تحميل بيانات التتبع، حاول مرة أخرى.");
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchTracking, token],
  );

  useEffect(() => {
    mounted.current = true;
    void load();
    // Live: refresh automatically while the page is open.
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 45000);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" dir="rtl">
        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">تعذر عرض التتبع</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <a href="/track-order" className="mt-4 inline-block text-sm text-primary underline">
          البحث برقم الطلب والبريد
        </a>
      </div>
    );
  }

  const effective = (data.shipping_status || data.status || "").toLowerCase();
  const currentIndex = ORDER_INDEX[effective] ?? 0;
  const isFailed = ["cancelled", "returned", "failed"].includes(effective);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8" dir="rtl">
      <header className="mb-6 text-center">
        <Truck className="mx-auto mb-2 h-9 w-9 text-primary" />
        <h1 className="text-2xl font-semibold">تتبع شحنتك</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          طلب رقم <span className="font-mono">{data.order_number}</span>
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">الحالة الحالية</p>
            <p className={`text-lg font-semibold ${isFailed ? "text-red-500" : "text-foreground"}`}>
              {LABELS[effective] ?? effective}
            </p>
          </div>
          <button
            onClick={() => void load(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>

        {!isFailed && (
          <ol className="relative space-y-0">
            {STAGES.map((stage, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              const Icon = stage.icon;
              return (
                <li key={stage.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                        done
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      } ${active ? "ring-2 ring-primary/30" : ""}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {i < STAGES.length - 1 && (
                      <span className={`my-1 h-8 w-px ${i < currentIndex ? "bg-primary/50" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="pb-2 pt-1.5">
                    <p className={`text-sm ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {stage.label}
                    </p>
                    {stage.key === "shipped" && data.shipped_at && (
                      <p className="text-[11px] text-muted-foreground">{fmt(data.shipped_at)}</p>
                    )}
                    {stage.key === "delivered" && data.delivered_at && (
                      <p className="text-[11px] text-muted-foreground">{fmt(data.delivered_at)}</p>
                    )}
                    {stage.key === "confirmed" && (
                      <p className="text-[11px] text-muted-foreground">{fmt(data.created_at)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {data.estimated_delivery_at && !data.delivered_at && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 p-3 text-xs">
            <Clock className="h-3.5 w-3.5 text-primary" />
            التسليم المتوقع: {fmt(data.estimated_delivery_at)}
          </div>
        )}
      </section>

      {(data.tracking_number || data.carrier) && (
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">رقم التتبع</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm" dir="ltr">
              {data.tracking_number ?? "—"}
            </span>
            {data.tracking_number && (
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(data.tracking_number!);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="نسخ رقم التتبع"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            {copied && <span className="text-[11px] text-green-600">تم النسخ</span>}
          </div>
          {data.carrier && (
            <p className="mt-1 text-[11px] text-muted-foreground">شركة الشحن: {data.carrier.toUpperCase()}</p>
          )}
          {data.city && <p className="text-[11px] text-muted-foreground">الوجهة: {data.city}</p>}
          {data.carrier_tracking_url && (
            <a
              href={data.carrier_tracking_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> تتبع لدى شركة الشحن
            </a>
          )}
        </section>
      )}

      {data.events?.length > 0 && (
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">سجل الشحنة</h2>
          <ul className="space-y-3">
            {data.events.map((e, i) => (
              <li key={`${e.status}-${i}`} className="flex gap-3 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-medium text-foreground">{LABELS[e.status.toLowerCase()] ?? e.status}</p>
                  {e.description && <p className="text-muted-foreground">{e.description}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {fmt(e.occurred_at)}
                    {e.location ? ` — ${e.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.items?.length > 0 && (
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">محتويات الطلب</h2>
          <ul className="space-y-2">
            {data.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                {it.image && <img src={it.image} alt={it.name} loading="lazy" className="h-10 w-10 rounded object-cover" />}
                <span className="flex-1 truncate">{it.name}</span>
                <span className="text-muted-foreground">×{it.qty}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">الإجمالي</span>
            <span className="font-semibold">
              {Number(data.total).toFixed(2)} {data.currency}
            </span>
          </div>
        </section>
      )}

      {updatedAt && (
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          آخر تحديث: {updatedAt.toLocaleTimeString("ar-SA")} — يتم التحديث تلقائياً
        </p>
      )}
    </div>
  );
}
