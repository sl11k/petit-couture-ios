import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ProductPickerModal } from "@/components/admin/ProductPicker";
import { supabase } from "@/integrations/supabase/client";
import { placeOrder } from "@/lib/placeOrder.functions";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/admin/create-order")({
  component: CreateOrderPage,
});

const TAX_RATE = 0.15;

type SizeRow = { size: string; sku: string | null; price: number | null; stock: number };
type Line = {
  productId: string;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  basePrice: number;
  baseSku: string | null;
  sizes: SizeRow[];
  selectedSize: string; // "" when the product has no sizes
  qty: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function CreateOrderPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const navigate = useNavigate();

  const [picker, setPicker] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shippingFee, setShippingFee] = useState(0);

  const unitPriceOf = (l: Line) => {
    const sel = l.sizes.find((s) => s.size === l.selectedSize);
    return sel?.price ?? l.basePrice;
  };
  const skuOf = (l: Line) => {
    const sel = l.sizes.find((s) => s.size === l.selectedSize);
    return sel?.sku ?? l.baseSku;
  };
  const maxQtyOf = (l: Line) => {
    const sel = l.sizes.find((s) => s.size === l.selectedSize);
    return sel ? Math.max(0, sel.stock) : Infinity;
  };

  const subtotal = round2(lines.reduce((s, l) => s + unitPriceOf(l) * l.qty, 0));
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + Number(shippingFee || 0) + tax);

  async function addProducts(ids: string[]) {
    setPicker(false);
    const newIds = ids.filter((id) => !lines.some((l) => l.productId === id));
    if (!newIds.length) return;
    setLoadingAdd(true);
    try {
      const [{ data: prods }, { data: variants }] = await Promise.all([
        supabase.from("products").select("id, slug, name_ar, name_en, brand, price, image_url, sku").in("id", newIds),
        (supabase as any).from("product_variants").select("product_id, size, sku, price, stock, is_active, attributes, sort_order").in("product_id", newIds).order("sort_order", { ascending: true }),
      ]);
      const sizesByProduct = new Map<string, SizeRow[]>();
      for (const v of ((variants ?? []) as any[])) {
        if (v?.attributes?.kind !== "size" || v?.is_active === false || !String(v?.size ?? "").trim()) continue;
        const arr = sizesByProduct.get(v.product_id) ?? [];
        arr.push({ size: String(v.size).trim(), sku: v.sku ?? null, price: v.price != null ? Number(v.price) : null, stock: Number(v.stock) || 0 });
        sizesByProduct.set(v.product_id, arr);
      }
      const added: Line[] = ((prods ?? []) as any[]).map((p) => {
        const sizes = sizesByProduct.get(p.id) ?? [];
        const firstAvailable = sizes.find((s) => s.stock > 0) ?? sizes[0];
        return {
          productId: p.id,
          slug: p.slug,
          name: (ar ? p.name_ar : p.name_en) || p.name_en || p.name_ar || p.slug,
          brand: p.brand ?? null,
          image: p.image_url ?? null,
          basePrice: p.price != null ? Number(p.price) : 0,
          baseSku: p.sku ?? null,
          sizes,
          selectedSize: firstAvailable?.size ?? "",
          qty: 1,
        };
      });
      // keep picker order
      const ordered = newIds.map((id) => added.find((l) => l.productId === id)).filter(Boolean) as Line[];
      setLines((prev) => [...prev, ...ordered]);
    } catch (e: any) {
      toast.error(e?.message || (ar ? "تعذّر إضافة المنتجات" : "Failed to add products"));
    } finally {
      setLoadingAdd(false);
    }
  }

  const patch = (idx: number, p: Partial<Line>) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  async function submit() {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error(ar ? "أدخل اسم العميل والبريد والجوال" : "Enter customer name, email and phone");
      return;
    }
    if (!lines.length) {
      toast.error(ar ? "أضف منتجاً واحداً على الأقل" : "Add at least one product");
      return;
    }
    // Validate sizes selected + stock
    for (const l of lines) {
      if (l.sizes.length && !l.selectedSize) {
        toast.error(ar ? `اختر مقاساً لـ ${l.name}` : `Pick a size for ${l.name}`);
        return;
      }
      if (l.qty < 1) {
        toast.error(ar ? `الكمية غير صحيحة لـ ${l.name}` : `Invalid quantity for ${l.name}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const sessionId = `admin-manual-${crypto.randomUUID()}`;
      const items = lines.map((l) => ({
        slug: l.slug,
        name: l.name,
        brand: l.brand,
        image: l.image,
        price: unitPriceOf(l),
        qty: l.qty,
        size: l.selectedSize || null,
        color: null,
        sku: skuOf(l) || null,
      }));
      const res = await placeOrder({
        data: {
          session_id: sessionId,
          user_id: null,
          items,
          address: {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            city: city.trim() || null,
            street: street.trim() || null,
            district: district.trim() || null,
            notes: notes.trim() || null,
          } as Record<string, unknown> as never,
          currency: "SAR",
          payment_method: paymentMethod as never,
          pricing: { subtotal, shipping_fee: round2(Number(shippingFee || 0)), tax, total, shipping_method: "standard" },
        },
      });
      const order = (res as any)?.order;
      toast.success(ar ? `تم إنشاء الطلب ${order?.order_number ?? ""}` : `Order ${order?.order_number ?? ""} created`);
      if (order?.id) navigate({ to: "/admin/orders/$id", params: { id: order.id } });
      else navigate({ to: "/admin/orders" });
    } catch (e: any) {
      toast.error(e?.message || (ar ? "تعذّر إنشاء الطلب" : "Failed to create order"));
    } finally {
      setSubmitting(false);
    }
  }

  const money = (n: number) => `${n.toLocaleString(ar ? "ar" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ar ? "ر.س" : "SAR"}`;

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        title={{ ar: "إنشاء طلب", en: "Create Order" }}
        description={{ ar: "أنشئ طلباً يدوياً لعميل", en: "Create a manual order for a customer" }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Items + customer */}
        <div className="space-y-4 lg:col-span-2">
          {/* Products */}
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">{ar ? "المنتجات" : "Products"}</h2>
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> {ar ? "إضافة منتج" : "Add product"}
              </button>
            </div>

            {loadingAdd && (
              <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {ar ? "جارِ التحميل..." : "Loading..."}</p>
            )}

            {lines.length === 0 && !loadingAdd ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <ShoppingBag className="mx-auto mb-2 h-6 w-6" />
                {ar ? "لا توجد منتجات بعد — اضغط \"إضافة منتج\"." : "No products yet — click \"Add product\"."}
              </div>
            ) : (
              <ul className="space-y-2">
                {lines.map((l, idx) => {
                  const max = maxQtyOf(l);
                  const oversold = Number.isFinite(max) && l.qty > max;
                  return (
                    <li key={l.productId} className="rounded-md border border-border bg-background p-2.5">
                      <div className="flex items-center gap-3">
                        {l.image ? <img src={l.image} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{l.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{skuOf(l) || "—"} · {money(unitPriceOf(l))}</p>
                        </div>
                        <button type="button" onClick={() => removeLine(idx)} className="grid h-7 w-7 place-items-center rounded-md text-destructive hover:bg-destructive/10" aria-label={ar ? "حذف" : "Remove"}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        {l.sizes.length > 0 && (
                          <label className="text-[11px] text-muted-foreground">
                            <span className="mb-0.5 block">{ar ? "المقاس" : "Size"}</span>
                            <select value={l.selectedSize} onChange={(e) => patch(idx, { selectedSize: e.target.value })} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                              <option value="">{ar ? "— اختر —" : "— select —"}</option>
                              {l.sizes.map((s) => (
                                <option key={s.size} value={s.size} disabled={s.stock <= 0}>
                                  {s.size}{s.stock <= 0 ? (ar ? " (نفد)" : " (out)") : ` · ${s.stock}`}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="text-[11px] text-muted-foreground">
                          <span className="mb-0.5 block">{ar ? "الكمية" : "Qty"}</span>
                          <input type="number" min={1} value={l.qty} onChange={(e) => patch(idx, { qty: Math.max(1, Number(e.target.value) || 1) })} className={`h-8 w-20 rounded-md border bg-background px-2 text-xs ${oversold ? "border-red-400" : "border-input"}`} dir="ltr" />
                        </label>
                        <div className="ms-auto text-xs">
                          <span className="text-muted-foreground">{ar ? "الإجمالي: " : "Total: "}</span>
                          <span className="font-medium">{money(unitPriceOf(l) * l.qty)}</span>
                        </div>
                      </div>
                      {oversold && <p className="mt-1 text-[11px] text-red-600">{ar ? `المتوفر ${max} فقط` : `Only ${max} available`}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Customer */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">{ar ? "بيانات العميل" : "Customer details"}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "الاسم الكامل *" : "Full name *"} value={fullName} onChange={setFullName} />
              <Field label={ar ? "الجوال *" : "Phone *"} value={phone} onChange={setPhone} dir="ltr" />
              <Field label={ar ? "البريد الإلكتروني *" : "Email *"} value={email} onChange={setEmail} dir="ltr" type="email" />
              <Field label={ar ? "المدينة" : "City"} value={city} onChange={setCity} />
              <Field label={ar ? "الحي" : "District"} value={district} onChange={setDistrict} />
              <Field label={ar ? "الشارع / العنوان" : "Street / address"} value={street} onChange={setStreet} />
              <label className="text-[11px] text-muted-foreground sm:col-span-2">
                <span className="mb-1 block">{ar ? "ملاحظات" : "Notes"}</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
              </label>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">{ar ? "ملخص الطلب" : "Order summary"}</h2>
            <div className="space-y-2 text-xs">
              <label className="block text-muted-foreground">
                <span className="mb-1 block">{ar ? "طريقة الدفع" : "Payment method"}</span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="cod">{ar ? "الدفع عند الاستلام" : "Cash on delivery"}</option>
                  <option value="bank_transfer">{ar ? "تحويل بنكي" : "Bank transfer"}</option>
                  <option value="card">{ar ? "بطاقة" : "Card"}</option>
                  <option value="apple_pay">Apple Pay</option>
                </select>
              </label>
              <label className="block text-muted-foreground">
                <span className="mb-1 block">{ar ? "رسوم الشحن" : "Shipping fee"}</span>
                <input type="number" min={0} step={0.01} value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value) || 0)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" dir="ltr" />
              </label>
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                <Row label={ar ? "المجموع الفرعي" : "Subtotal"} value={money(subtotal)} />
                <Row label={ar ? "الشحن" : "Shipping"} value={money(round2(Number(shippingFee || 0)))} />
                <Row label={ar ? "ضريبة (15%)" : "VAT (15%)"} value={money(tax)} />
                <div className="flex items-center justify-between border-t border-border pt-1 text-sm font-semibold">
                  <span>{ar ? "الإجمالي" : "Total"}</span>
                  <span>{money(total)}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || lines.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              {ar ? "إنشاء الطلب" : "Create order"}
            </button>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {ar ? "ينشئ الطلب ويخصم المخزون ويُنشئ الشحنة تلقائياً (مثل طلب المتجر)." : "Creates the order, decrements stock and auto-creates the shipment (like a storefront order)."}
            </p>
          </section>
        </aside>
      </div>

      {picker && (
        <ProductPickerModal
          excludedIds={lines.map((l) => l.productId)}
          onClose={() => setPicker(false)}
          onAdd={addProducts}
        />
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", dir }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: "ltr" | "rtl" }) {
  return (
    <label className="text-[11px] text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
