import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { isOrderEligibleForReturn } from "@/lib/returns";
import { Upload, X, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/account/returns/new")({
  head: () =>
    buildMeta({
      title: "طلب استرجاع — Le Petit Paradis",
      description:
        "اطلب استرجاع منتج من طلبك بسهولة عبر نموذج Le Petit Paradis.",
      path: "/account/returns/new",
      noindex: true,
    }),
  component: NewReturnRequest,
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s.order === "string" ? s.order : "" }),
});

const schema = z.object({
  order_id: z.string().uuid({ message: "اختر طلباً" }),
  reason: z.string().trim().min(2, "اختر سبباً").max(120),
  reason_details: z.string().trim().max(1000).optional(),
  refund_method: z.string(),
  customer_notes: z.string().trim().max(1000).optional(),
  items: z.array(z.object({
    order_item_id: z.string().uuid(),
    product_id: z.string().uuid().nullable(),
    product_name: z.string(),
    qty: z.number().int().min(1),
    unit_price: z.number(),
  })).min(1, "اختر منتجاً واحداً على الأقل"),
});

function NewReturnRequest() {
  const { order: orderParam } = useSearch({ from: "/account/returns/new" });
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState(orderParam || "");
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [nonReturnable, setNonReturnable] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { void navigate({ to: "/login" }); return; }
      const [{ data: ods }, { data: s }, { data: nr }] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, created_at, total").eq("user_id", user.id).eq("status", "delivered").order("created_at", { ascending: false }),
        supabase.from("return_settings").select("*").maybeSingle(),
        supabase.from("non_returnable_products").select("product_id"),
      ]);
      setOrders(ods ?? []);
      setSettings(s);
      setNonReturnable(new Set((nr ?? []).map((x: any) => x.product_id)));
    })();
  }, [navigate]);

  useEffect(() => {
    if (!orderId) { setOrderItems([]); setEligibility(null); return; }
    void (async () => {
      const eli = await isOrderEligibleForReturn(orderId);
      setEligibility(eli);
      const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      setOrderItems(data ?? []);
      setSelected({});
    })();
  }, [orderId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const urls: string[] = [];
      for (const f of files.slice(0, 6 - photos.length)) {
        if (f.size > 5 * 1024 * 1024) { setError("الحد الأقصى لحجم الصورة 5 ميجا"); continue; }
        const path = `${user.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("return-photos").upload(path, f);
        if (upErr) { setError(upErr.message); continue; }
        const { data: { publicUrl } } = supabase.storage.from("return-photos").getPublicUrl(path);
        urls.push(publicUrl);
      }
      setPhotos((p) => [...p, ...urls]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submit() {
    setError(null);
    if (eligibility && !eligibility.ok) { setError(eligibility.reason ?? "غير مؤهل"); return; }
    const items = orderItems
      .filter((it) => (selected[it.id] ?? 0) > 0)
      .filter((it) => !it.product_id || !nonReturnable.has(it.product_id))
      .map((it) => ({
        order_item_id: it.id, product_id: it.product_id, product_name: it.product_name,
        qty: selected[it.id], unit_price: Number(it.unit_price),
      }));
    const parsed = schema.safeParse({
      order_id: orderId, reason, reason_details: reasonDetails || undefined,
      refund_method: refundMethod, customer_notes: notes || undefined, items,
    });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("سجل الدخول أولاً");
      const order = orders.find((o) => o.id === orderId);
      const { data: req, error: reqErr } = await supabase.from("return_requests").insert({
        order_id: orderId, order_number: order?.order_number, user_id: user.id,
        customer_email: user.email!, reason, reason_details: reasonDetails || null,
        refund_method: refundMethod, customer_notes: notes || null, photos: photos as unknown as any,
      } as any).select("id").single();
      if (reqErr) throw reqErr;
      const itemsToInsert = items.map((it) => ({ ...it, return_request_id: req.id }));
      const { error: itErr } = await supabase.from("return_items").insert(itemsToInsert);
      if (itErr) throw itErr;
      void navigate({ to: "/account" });
    } catch (e: any) {
      setError(e.message ?? "فشل الإرسال");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/account" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> رجوع للحساب
      </Link>
      <h1 className="mb-2 text-2xl font-semibold">طلب استرجاع</h1>

      {settings?.policy_text_ar && (
        <div className="mb-5 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="mb-1 font-semibold">سياسة الاسترجاع</div>
          <p className="text-muted-foreground">{settings.policy_text_ar}</p>
          <p className="mt-1 text-xs text-muted-foreground">المدة المسموحة: {settings.return_window_days ?? 14} يوماً • {settings.deduct_shipping_fee ? `سيُخصم ${settings.shipping_fee_amount} ر.س رسوم شحن` : "لا تُخصم رسوم شحن"}</p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <label className="block text-sm">
          <span className="mb-1 block">اختر الطلب</span>
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2">
            <option value="">— اختر —</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} • {Number(o.total).toFixed(0)} ر.س</option>)}
          </select>
        </label>

        {eligibility && !eligibility.ok && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{eligibility.reason}</div>
        )}

        {orderItems.length > 0 && eligibility?.ok && (
          <div>
            <div className="mb-2 text-sm font-semibold">المنتجات</div>
            <div className="space-y-2">
              {orderItems.map((it) => {
                const blocked = it.product_id && nonReturnable.has(it.product_id);
                return (
                  <div key={it.id} className={`flex items-center gap-3 rounded-md border p-2 text-sm ${blocked ? "opacity-50 border-dashed" : "border-border"}`}>
                    {it.image_url && <img src={it.image_url} alt={it.product_name} className="h-12 w-12 rounded object-cover" />}
                    <div className="flex-1">
                      <div>{it.product_name}</div>
                      <div className="text-xs text-muted-foreground">{Number(it.unit_price).toFixed(0)} ر.س × {it.qty}</div>
                      {blocked && <div className="text-xs text-red-600">غير قابل للإرجاع</div>}
                    </div>
                    {!blocked && (
                      <select value={selected[it.id] ?? 0} onChange={(e) => setSelected({ ...selected, [it.id]: Number(e.target.value) })}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                        {Array.from({ length: it.qty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block">سبب الاسترجاع</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2">
            <option value="">— اختر السبب —</option>
            {(settings?.reasons ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block">تفاصيل إضافية</span>
          <textarea value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} rows={3} maxLength={1000}
            className="w-full rounded-md border border-border bg-background px-3 py-2" />
        </label>

        <div>
          <div className="mb-2 text-sm">صور المنتج (اختياري — حد أقصى 6)</div>
          <div className="flex flex-wrap gap-2">
            {photos.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-20 w-20 rounded object-cover" />
                <button onClick={() => setPhotos(photos.filter((p) => p !== url))} className="absolute -top-1 -left-1 rounded-xl bg-red-500 p-0.5 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-border text-muted-foreground hover:border-primary">
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                <Upload className="h-5 w-5" />
              </label>
            )}
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block">طريقة الاسترداد</span>
          <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2">
            {(settings?.refund_methods ?? ["original"]).map((m: string) => (
              <option key={m} value={m}>{
                m === "original" ? "نفس وسيلة الدفع" : m === "store_credit" ? "رصيد متجر" : m === "bank_transfer" ? "تحويل بنكي" : m === "exchange" ? "استبدال" : m
              }</option>
            ))}
            <option value="exchange">استبدال بمنتج آخر</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block">ملاحظات</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000}
            className="w-full rounded-md border border-border bg-background px-3 py-2" />
        </label>

        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <button onClick={submit} disabled={submitting || !eligibility?.ok}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {submitting ? "جارٍ الإرسال..." : "إرسال طلب الاسترجاع"}
        </button>
      </div>
    </div>
  );
}
