import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";

export const Route = createFileRoute("/admin/create-order")({
  component: CreateOrderPage,
});

type Line = {
  product_id: string;
  product_slug: string;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  size: string;
  color: string;
  qty: number;
  unit_price: number;
};

function CreateOrderPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState({ city: "", district: "", street: "", building: "", notes: "" });
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card" | "bank_transfer">("cod");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name_ar")
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  function addProduct(p: any) {
    setLines((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_slug: p.slug,
        product_name: p.name_ar || p.name_en,
        brand: p.brand,
        image_url: p.image_url,
        size: (Array.isArray(p.sizes) && p.sizes[0]) || "—",
        color: (Array.isArray(p.colors) && p.colors[0]) || "—",
        qty: 1,
        unit_price: Number(p.price),
      },
    ]);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const shipping_fee = subtotal > 500 ? 0 : 25;
  const tax = subtotal * 0.15;
  const total = subtotal + shipping_fee + tax;

  async function submit() {
    if (lines.length === 0 || !customer.name || !customer.phone) {
      alert("أضف منتج واملأ بيانات العميل");
      return;
    }
    setSaving(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: customer.name,
        customer_email: customer.email || `noemail+${Date.now()}@store.local`,
        customer_phone: customer.phone,
        payment_method: paymentMethod,
        status: "processing",
        subtotal,
        shipping_fee,
        tax,
        total,
        currency: "SAR",
        shipping_address: address,
        created_by_admin: true,
      })
      .select()
      .single();

    if (error || !order) {
      alert("خطأ: " + error?.message);
      setSaving(false);
      return;
    }

    await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        product_slug: l.product_slug,
        product_name: l.product_name,
        brand: l.brand,
        image_url: l.image_url,
        size: l.size,
        color: l.color,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: l.qty * l.unit_price,
      })),
    );

    setSaving(false);
    navigate({ to: "/admin/orders" });
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold">إنشاء طلب جديد (نيابة عن العميل)</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-semibold">بيانات العميل</h2>
            <div className="grid gap-3">
              <input
                placeholder="الاسم"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder="الهاتف"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder="الإيميل (اختياري)"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-semibold">عنوان الشحن</h2>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="المدينة" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input placeholder="الحي" value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input placeholder="الشارع" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input placeholder="المبنى" value={address.building} onChange={(e) => setAddress({ ...address, building: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="cod">دفع عند الاستلام</option>
                <option value="card">بطاقة</option>
                <option value="bank_transfer">تحويل بنكي</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-semibold">إضافة منتج</h2>
            <select
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                if (p) addProduct(p);
                e.target.value = "";
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— اختر منتج —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_ar || p.name_en} — {Number(p.price).toFixed(0)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">السلة ({lines.length})</h2>
          {lines.length === 0 && <p className="text-sm text-muted-foreground">لا توجد منتجات.</p>}
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2">
                {l.image_url && <img src={l.image_url} className="h-12 w-12 rounded object-cover" alt="" />}
                <div className="flex-1">
                  <div className="text-sm">{l.product_name}</div>
                  <div className="flex gap-2">
                    <input
                      value={l.size}
                      onChange={(e) => updateLine(i, { size: e.target.value })}
                      className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                    />
                    <input
                      value={l.color}
                      onChange={(e) => updateLine(i, { color: e.target.value })}
                      className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                      className="w-14 rounded border border-input bg-background px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="text-sm">{(l.qty * l.unit_price).toFixed(2)}</div>
                <button onClick={() => removeLine(i)} className="text-destructive">
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <Row label="المجموع الفرعي" value={subtotal.toFixed(2)} />
            <Row label="الشحن" value={shipping_fee.toFixed(2)} />
            <Row label="الضريبة (15%)" value={tax.toFixed(2)} />
            <Row label="الإجمالي" value={`${total.toFixed(2)} SAR`} bold />
          </div>

          <button
            onClick={submit}
            disabled={saving || lines.length === 0}
            className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "..." : "إنشاء الطلب"}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function Row({ label, value, bold }: any) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
