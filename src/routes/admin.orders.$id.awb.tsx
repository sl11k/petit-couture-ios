import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadStoreSnapshot, formatMoney, type StoreSnapshot } from "@/lib/invoices";
import { Printer, ArrowRight, Package } from "lucide-react";

export const Route = createFileRoute("/admin/orders/$id/awb")({
  component: AwbPrint,
});

function AwbPrint() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shipment, setShipment] = useState<any>(null);
  const [store, setStore] = useState<StoreSnapshot>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [oRes, iRes, stRes, snap] = await Promise.all([
          supabase.from("orders").select("*").eq("id", id).maybeSingle(),
          supabase.from("order_items").select("*").eq("order_id", id),
          supabase.from("shipments").select("*").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          loadStoreSnapshot(),
        ]);
        if (!oRes.data) throw new Error("الطلب غير موجود");
        setOrder(oRes.data);
        setItems(iRes.data ?? []);
        setShipment(stRes.data ?? null);
        setStore(snap);
      } catch (e: any) {
        setError(e.message ?? "فشل تحميل بوليصة الشحن");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!order) return null;

  const addr = order.shipping_address ?? {};
  const tracking = shipment?.tracking_number ?? order.tracking_number ?? "—";
  const carrier = shipment?.carrier ?? order.shipping_carrier ?? "—";
  const totalQty = items.reduce((s, it) => s + Number(it.qty ?? 0), 0);
  const weight = shipment?.weight_kg ?? order.weight_kg ?? null;
  const codAmount = order.payment_method === "cod" && order.payment_status !== "paid" ? Number(order.total) : 0;
  const currency = order.currency === "SAR" ? "ر.س" : (order.currency ?? "ر.س");

  // باركود بسيط بصرياً (CSS bars) — للمسح الفعلي يفضّل تكامل barcode lib لاحقاً
  const barcodeChars = String(tracking).padEnd(12, "0").substring(0, 16);

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 print:bg-white">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-[210mm] mx-auto flex items-center justify-between p-3">
          <a href={`/admin/orders/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-4 h-4" /> رجوع للطلب
          </a>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              <Printer className="w-4 h-4" /> طباعة البوليصة
            </button>
          </div>
        </div>
      </div>

      {/* البوليصة — A5 افتراضياً */}
      <div className="max-w-[148mm] mx-auto bg-background my-6 shadow-sm print:shadow-none print:my-0 print:max-w-none border-2 border-foreground">
        {/* Header */}
        <div className="border-b-2 border-foreground p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="w-10 h-10 object-contain" />
            ) : (
              <Package className="w-8 h-8" />
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide">{store.store_name ?? "المتجر"}</p>
              <p className="text-[10px] text-muted-foreground">بوليصة شحن</p>
            </div>
          </div>
          <div className="text-end">
            <p className="text-xs text-muted-foreground">رقم الطلب</p>
            <p className="font-mono font-bold text-sm">{order.order_number}</p>
          </div>
        </div>

        {/* الناقل + رقم التتبع */}
        <div className="bg-foreground text-background p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase opacity-75">الناقل</p>
            <p className="font-bold text-base">{carrier}</p>
          </div>
          <div className="text-end">
            <p className="text-[10px] uppercase opacity-75">رقم التتبع</p>
            <p className="font-mono font-bold text-base">{tracking}</p>
          </div>
        </div>

        {/* Barcode بصري */}
        <div className="border-b-2 border-foreground p-3 text-center">
          <div className="flex items-center justify-center gap-[1px] h-12 bg-white">
            {barcodeChars.split("").map((c, i) => {
              const code = c.charCodeAt(0);
              const widths = [1, 2, 1, 3, 2, 1, 2, 1];
              return (
                <div key={i} className="flex items-stretch gap-[1px]">
                  {widths.map((w, j) => (
                    <div
                      key={j}
                      className="bg-foreground"
                      style={{ width: `${((code + j) % 3) + w}px` }}
                    />
                  ))}
                  <div className="bg-background" style={{ width: "2px" }} />
                </div>
              );
            })}
          </div>
          <p className="font-mono text-xs mt-1 tracking-widest">{tracking}</p>
        </div>

        {/* المرسل */}
        <div className="border-b border-foreground/30 p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">من / FROM</p>
          <p className="font-semibold text-sm">{store.company_legal_name || store.store_name}</p>
          {store.address && <p className="text-xs">{store.address}</p>}
          {store.city && <p className="text-xs">{store.city}{store.country ? `، ${store.country}` : ""}</p>}
          {store.phone && <p className="text-xs font-mono" dir="ltr">{store.phone}</p>}
        </div>

        {/* المرسل إليه — الأبرز */}
        <div className="border-b-2 border-foreground p-4 bg-muted/20">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">إلى / TO</p>
          <p className="font-bold text-lg">{order.customer_name ?? addr.name ?? "—"}</p>
          {order.customer_phone && <p className="text-sm font-mono mt-1" dir="ltr">{order.customer_phone}</p>}
          {addr.line1 && <p className="text-sm mt-1">{addr.line1}</p>}
          {addr.line2 && <p className="text-sm">{addr.line2}</p>}
          {(addr.district || addr.city) && (
            <p className="text-sm font-semibold mt-1">
              {[addr.district, addr.city].filter(Boolean).join("، ")}
            </p>
          )}
          {addr.postal_code && <p className="text-sm">الرمز البريدي: <span className="font-mono">{addr.postal_code}</span></p>}
          {addr.notes && <p className="text-xs mt-2 p-2 bg-warning/10 rounded">📍 {addr.notes}</p>}
        </div>

        {/* تفاصيل الشحنة */}
        <div className="grid grid-cols-3 border-b border-foreground/30 text-center text-xs">
          <div className="p-3 border-l border-foreground/30">
            <p className="text-[10px] text-muted-foreground uppercase">الطرود</p>
            <p className="font-bold text-lg">{shipment?.packages_count ?? 1}</p>
          </div>
          <div className="p-3 border-l border-foreground/30">
            <p className="text-[10px] text-muted-foreground uppercase">القطع</p>
            <p className="font-bold text-lg">{totalQty}</p>
          </div>
          <div className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">الوزن</p>
            <p className="font-bold text-lg">{weight ? `${weight} كجم` : "—"}</p>
          </div>
        </div>

        {/* COD — بارز إذا كان دفع عند الاستلام */}
        {codAmount > 0 && (
          <div className="bg-warning text-warning-foreground p-3 text-center border-b-2 border-foreground">
            <p className="text-[10px] uppercase font-bold">الدفع عند الاستلام — COD</p>
            <p className="text-2xl font-bold font-mono">{formatMoney(codAmount, currency)}</p>
            <p className="text-[10px]">يُحصَّل المبلغ من العميل عند التسليم</p>
          </div>
        )}

        {/* محتويات الطلب — قائمة مختصرة */}
        <div className="p-3 border-b border-foreground/30">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">محتويات الطرد</p>
          <ul className="space-y-1 text-xs">
            {items.slice(0, 8).map((it, i) => (
              <li key={it.id ?? i} className="flex justify-between gap-2">
                <span className="truncate">{it.product_name}{it.variant_label ? ` — ${it.variant_label}` : ""}</span>
                <span className="font-mono shrink-0">×{it.qty}</span>
              </li>
            ))}
            {items.length > 8 && (
              <li className="text-muted-foreground italic">… و {items.length - 8} عنصر آخر</li>
            )}
          </ul>
        </div>

        {/* Footer */}
        <div className="p-2 text-center text-[10px] text-muted-foreground">
          <p>تاريخ الإنشاء: {new Date().toLocaleString("ar-SA")} — {store.store_name}</p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A5; margin: 6mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
