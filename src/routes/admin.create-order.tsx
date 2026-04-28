import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useAuth } from "@/state/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import LocationPicker, { type ResolvedLocation } from "@/components/checkout/LocationPicker";
import {
  Search, User, UserPlus, Package, Trash2, Plus, Minus,
  MapPin, Truck, CreditCard, FileText, Check, ChevronRight,
  Phone, Mail, MessageCircle, AlertTriangle, Tag, Gift, Lock,
} from "lucide-react";

export const Route = createFileRoute("/admin/create-order")({
  component: CreateOrderPage,
});

// ============= Types =============
type OrderType = "regular" | "phone" | "whatsapp" | "special" | "compensation" | "gift";
type PaymentChoice = "cod" | "card" | "bank_transfer" | "payment_link" | "manual" | "store_credit";
type Carrier = "smsa" | "aramex" | "spl" | "naqel" | "redbox" | "internal";

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  regular: "طلب عادي",
  phone: "عبر الهاتف",
  whatsapp: "عبر واتساب",
  special: "طلب خاص",
  compensation: "تعويضي",
  gift: "هدية",
};

const ORDER_TYPE_SOURCE: Record<OrderType, string> = {
  regular: "admin",
  phone: "phone",
  whatsapp: "whatsapp",
  special: "admin_special",
  compensation: "compensation",
  gift: "gift",
};

const CARRIER_LABEL: Record<Carrier, string> = {
  smsa: "SMSA",
  aramex: "Aramex",
  spl: "البريد السعودي",
  naqel: "Naqel",
  redbox: "RedBox",
  internal: "توصيل داخلي",
};

type Customer = {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
};

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
  stock: number;
  override_stock?: boolean;
  is_free?: boolean;
  discount_pct?: number; // 0-100
};

const STEPS = [
  { id: 1, label: "العميل", icon: User },
  { id: 2, label: "المنتجات", icon: Package },
  { id: 3, label: "الشحن", icon: Truck },
  { id: 4, label: "الدفع", icon: CreditCard },
  { id: 5, label: "مراجعة", icon: FileText },
] as const;

function CreateOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEditOrders, canManage, isAdmin, loading: roleLoading } = useUserRole();

  // ============ Permissions ============
  // canEditOrders: can create order at all
  // canManage (admin/manager): can apply discounts, override stock, register manual payment
  const canDiscount = canManage;
  const canOverrideStock = canManage;
  const canManualPayment = canManage;

  const [step, setStep] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>("phone");

  // Customer
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "" });
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [pastOrders, setPastOrders] = useState<any[]>([]);
  const [customerNotes, setCustomerNotes] = useState("");

  // Address
  const [address, setAddress] = useState({
    city: "", district: "", street: "", building: "", postalCode: "", notes: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  // Shipping
  const [carrier, setCarrier] = useState<Carrier>("smsa");
  const [shippingFeeOverride, setShippingFeeOverride] = useState<number | null>(null);
  const [warehouse, setWarehouse] = useState("main");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("cod");
  const [paymentReference, setPaymentReference] = useState("");
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitAmount, setSplitAmount] = useState(0);

  // Internal
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ Load products ============
  useEffect(() => {
    supabase
      .from("products")
      .select("id, slug, name_ar, name_en, brand, image_url, price, sizes, colors, stock, is_active")
      .eq("is_active", true)
      .order("name_ar")
      .limit(500)
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  // ============ Customer search ============
  useEffect(() => {
    if (customerSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const q = customerSearch.trim();
    supabase
      .from("profiles")
      .select("id, user_id, full_name, email, phone")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10)
      .then(({ data }) => {
        if (cancelled) return;
        setSearchResults(data ?? []);
        setSearching(false);
      });
    return () => { cancelled = true; };
  }, [customerSearch]);

  function pickCustomer(p: any) {
    setCustomer({
      id: p.id,
      user_id: p.user_id,
      name: p.full_name || "",
      email: p.email || "",
      phone: p.phone || "",
    });
    setCustomerSearch("");
    setSearchResults([]);
    // load past orders + notes
    if (p.user_id) {
      supabase
        .from("orders")
        .select("id, order_number, total, currency, status, created_at")
        .eq("user_id", p.user_id)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }) => setPastOrders(data ?? []));
    }
  }

  // ============ Products ============
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products
      .filter((p) =>
        (p.name_ar || "").toLowerCase().includes(q) ||
        (p.name_en || "").toLowerCase().includes(q) ||
        (p.slug || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [products, productQuery]);

  function addProduct(p: any) {
    if (p.stock <= 0 && !canOverrideStock) {
      setError("هذا المنتج غير متوفر — لا تملك صلاحية تجاوز المخزون");
      return;
    }
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.product_id === p.id);
      if (existing >= 0) {
        return prev.map((l, i) => (i === existing ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
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
          stock: Number(p.stock || 0),
          override_stock: p.stock <= 0,
        },
      ];
    });
    setError(null);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  // ============ Pricing ============
  const subtotalGross = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const discountTotal = lines.reduce((s, l) => {
    if (l.is_free) return s + l.qty * l.unit_price;
    if (l.discount_pct && l.discount_pct > 0) return s + (l.qty * l.unit_price * l.discount_pct) / 100;
    return s;
  }, 0);
  const subtotal = subtotalGross - discountTotal;
  const baseShipping = subtotal > 500 ? 0 : 25;
  const shipping_fee = shippingFeeOverride ?? baseShipping;
  const tax = subtotal * 0.15;
  const total = subtotal + shipping_fee + tax;

  // ============ Validation per step ============
  const customerValid = customer.name.trim().length > 0 && customer.phone.trim().length >= 7;
  const productsValid = lines.length > 0;
  const addressValid = address.city.trim().length > 0;

  function canGoNext() {
    if (step === 1) return customerValid;
    if (step === 2) return productsValid;
    if (step === 3) return addressValid;
    if (step === 4) return true;
    return true;
  }

  // ============ Submit ============
  async function submit() {
    if (!canEditOrders) {
      setError("لا تملك صلاحية إنشاء طلبات");
      return;
    }
    if (!productsValid || !customerValid || !addressValid) {
      setError("بعض الحقول المطلوبة ناقصة");
      return;
    }
    setSaving(true);
    setError(null);

    const shippingAddress = {
      fullName: customer.name,
      email: customer.email,
      phone: customer.phone,
      ...address,
      lat: coords?.lat,
      lng: coords?.lng,
      delivery_window: deliveryWindow || null,
      delivery_notes: deliveryNotes || null,
      warehouse,
    };

    const initialPaymentStatus =
      paymentMethod === "manual" ? "paid" :
      paymentMethod === "store_credit" ? "paid" :
      "unpaid";

    const internalNotesArr = [
      ...(internalNote.trim() ? [{
        text: internalNote.trim(),
        author_email: user?.email ?? null,
        author_id: user?.id ?? null,
        created_at: new Date().toISOString(),
        pinned: false,
      }] : []),
      ...(paymentReference.trim() ? [{
        text: `مرجع الدفع: ${paymentReference.trim()}`,
        author_email: user?.email ?? null,
        author_id: user?.id ?? null,
        created_at: new Date().toISOString(),
        pinned: false,
      }] : []),
    ];

    const dbPaymentMethod =
      paymentMethod === "payment_link" ? "card" :
      paymentMethod === "manual" ? "bank_transfer" :
      paymentMethod === "store_credit" ? "cod" :
      paymentMethod;

    const { data: order, error: orderErr } = await (supabase
      .from("orders") as any)
      .insert({
        user_id: customer.user_id ?? null,
        customer_name: customer.name,
        customer_email: customer.email || `noemail+${Date.now()}@store.local`,
        customer_phone: customer.phone,
        status: "processing",
        payment_method: dbPaymentMethod,
        payment_status: initialPaymentStatus,
        shipping_status: "not_created",
        shipping_carrier: carrier,
        source: ORDER_TYPE_SOURCE[orderType],
        assigned_to: user?.id ?? null,
        subtotal,
        shipping_fee,
        tax,
        total,
        currency: "SAR",
        shipping_address: shippingAddress,
        shipping_lat: coords?.lat ?? null,
        shipping_lng: coords?.lng ?? null,
        notes: customerNotes || null,
        internal_notes: internalNotesArr,
        created_by_admin: true,
      })
      .select()
      .single();

    if (orderErr || !order) {
      setError(orderErr?.message || "فشل إنشاء الطلب");
      setSaving(false);
      return;
    }

    const { error: itemsErr } = await supabase.from("order_items").insert(
      lines.map((l) => {
        const lineDiscount = l.is_free ? 1 : (l.discount_pct ?? 0) / 100;
        const finalUnit = l.unit_price * (1 - lineDiscount);
        return {
          order_id: order.id,
          product_id: l.product_id,
          product_slug: l.product_slug,
          product_name: l.product_name,
          brand: l.brand,
          image_url: l.image_url,
          size: l.size,
          color: l.color,
          qty: l.qty,
          unit_price: finalUnit,
          line_total: finalUnit * l.qty,
        };
      }),
    );

    if (itemsErr) {
      setError("الطلب أُنشئ لكن فشلت إضافة المنتجات: " + itemsErr.message);
      setSaving(false);
      return;
    }

    // ============ Audit log ============
    await supabase.from("audit_logs").insert({
      action: "order.created_on_behalf",
      entity: "order",
      entity_id: order.id,
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      metadata: {
        order_number: order.order_number,
        order_type: orderType,
        source: ORDER_TYPE_SOURCE[orderType],
        total,
        payment_method: paymentMethod,
        items_count: lines.length,
        discount_total: discountTotal,
        shipping_override: shippingFeeOverride !== null,
        free_items: lines.filter((l) => l.is_free).length,
        stock_overrides: lines.filter((l) => l.override_stock).length,
      },
    });

    setSaving(false);
    navigate({ to: "/admin/orders/$id", params: { id: order.id } });
  }

  // ============ Communication helpers ============
  function whatsappLink() {
    const phone = customer.phone.replace(/\D/g, "");
    const msg = `مرحباً ${customer.name}، تم إنشاء طلبك بنجاح. الإجمالي: ${total.toFixed(2)} ريال.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  if (roleLoading) {
    return <AdminShell><div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div></AdminShell>;
  }

  if (!canEditOrders) {
    return (
      <AdminShell>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">صلاحية غير كافية</h2>
          <p className="mt-1 text-sm text-muted-foreground">لا تملك صلاحية إنشاء طلبات.</p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">إنشاء طلب جديد</h1>
          <p className="mt-1 text-sm text-muted-foreground">طلب نيابة عن العميل (On Behalf)</p>
        </div>
        <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">العودة للطلبات</Link>
      </div>

      {/* Order type */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted-foreground">نوع الطلب</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(ORDER_TYPE_LABEL) as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                orderType === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"
              }`}
            >
              {ORDER_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Stepper */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card p-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => (done || active ? setStep(s.id) : null)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                  active ? "bg-primary text-primary-foreground" :
                  done ? "bg-accent text-foreground" : "bg-background text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {step === 1 && (
            <CustomerStep
              customer={customer} setCustomer={setCustomer}
              customerSearch={customerSearch} setCustomerSearch={setCustomerSearch}
              searchResults={searchResults} searching={searching}
              pickCustomer={pickCustomer}
              pastOrders={pastOrders}
              customerNotes={customerNotes} setCustomerNotes={setCustomerNotes}
            />
          )}

          {step === 2 && (
            <ProductsStep
              productQuery={productQuery} setProductQuery={setProductQuery}
              filteredProducts={filteredProducts}
              addProduct={addProduct}
              lines={lines} updateLine={updateLine} removeLine={removeLine}
              canDiscount={canDiscount} canOverrideStock={canOverrideStock}
            />
          )}

          {step === 3 && (
            <ShippingStep
              address={address} setAddress={setAddress}
              coords={coords} setCoords={setCoords}
              carrier={carrier} setCarrier={setCarrier}
              shippingFeeOverride={shippingFeeOverride} setShippingFeeOverride={setShippingFeeOverride}
              baseShipping={baseShipping}
              warehouse={warehouse} setWarehouse={setWarehouse}
              deliveryWindow={deliveryWindow} setDeliveryWindow={setDeliveryWindow}
              deliveryNotes={deliveryNotes} setDeliveryNotes={setDeliveryNotes}
              canDiscount={canDiscount}
            />
          )}

          {step === 4 && (
            <PaymentStep
              paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
              paymentReference={paymentReference} setPaymentReference={setPaymentReference}
              splitPayment={splitPayment} setSplitPayment={setSplitPayment}
              splitAmount={splitAmount} setSplitAmount={setSplitAmount}
              total={total}
              canManualPayment={canManualPayment}
            />
          )}

          {step === 5 && (
            <ReviewStep
              orderType={orderType}
              customer={customer} address={address} coords={coords}
              lines={lines}
              subtotalGross={subtotalGross} discountTotal={discountTotal}
              subtotal={subtotal} shipping_fee={shipping_fee} tax={tax} total={total}
              carrier={carrier} paymentMethod={paymentMethod}
              customerNotes={customerNotes}
              internalNote={internalNote} setInternalNote={setInternalNote}
              whatsappLink={whatsappLink}
            />
          )}

          {/* Step navigation */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm disabled:opacity-50"
            >
              السابق
            </button>
            {step < 5 ? (
              <button
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                disabled={!canGoNext()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                التالي
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "جاري الإنشاء..." : "إنشاء الطلب"}
              </button>
            )}
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">ملخص الطلب</h3>
            <div className="mt-3 space-y-1 text-sm">
              <Row label={`المنتجات (${lines.length})`} value={subtotalGross.toFixed(2)} />
              {discountTotal > 0 && <Row label="الخصم" value={`-${discountTotal.toFixed(2)}`} className="text-emerald-600" />}
              <Row label="الشحن" value={shipping_fee === 0 ? "مجاني" : shipping_fee.toFixed(2)} />
              <Row label="الضريبة (15%)" value={tax.toFixed(2)} />
              <div className="my-2 border-t border-border" />
              <Row label="الإجمالي" value={`${total.toFixed(2)} SAR`} bold />
            </div>
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              <div>النوع: {ORDER_TYPE_LABEL[orderType]}</div>
              <div>الموظف: {user?.email || "—"}</div>
              {customer.id && <div>عميل موجود ✓</div>}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ============= Step 1: Customer =============
function CustomerStep({
  customer, setCustomer, customerSearch, setCustomerSearch,
  searchResults, searching, pickCustomer, pastOrders, customerNotes, setCustomerNotes,
}: any) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">البحث عن عميل</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="ابحث بالاسم، الإيميل، أو الجوال..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pe-9 ps-3 text-sm"
          />
        </div>
        {searching && <p className="mt-2 text-xs text-muted-foreground">جاري البحث...</p>}
        {searchResults.length > 0 && (
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-md border border-border">
            {searchResults.map((p: any) => (
              <button
                key={p.id}
                onClick={() => pickCustomer(p)}
                className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-right text-sm last:border-b-0 hover:bg-accent"
              >
                <div>
                  <div className="font-medium">{p.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.email} · {p.phone}</div>
                </div>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">بيانات العميل</h2>
          {customer.id && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">عميل موجود</span>}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="الاسم *" value={customer.name} onChange={(v: string) => setCustomer({ ...customer, name: v })} />
          <Field label="الجوال *" value={customer.phone} onChange={(v: string) => setCustomer({ ...customer, phone: v })} />
          <Field label="البريد الإلكتروني" value={customer.email} onChange={(v: string) => setCustomer({ ...customer, email: v })} className="sm:col-span-2" />
        </div>
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">ملاحظات العميل</label>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="مثال: يفضل التوصيل المسائي"
          />
        </div>
      </div>

      {pastOrders.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">طلبات سابقة ({pastOrders.length})</h2>
          <div className="mt-3 space-y-2">
            {pastOrders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div>
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ar-SA")}</div>
                </div>
                <div className="text-left">
                  <div>{Number(o.total).toFixed(2)} {o.currency}</div>
                  <div className="text-xs text-muted-foreground">{o.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ============= Step 2: Products =============
function ProductsStep({
  productQuery, setProductQuery, filteredProducts, addProduct,
  lines, updateLine, removeLine, canDiscount, canOverrideStock,
}: any) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">إضافة منتج</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="ابحث باسم المنتج، SKU، أو العلامة..."
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pe-9 ps-3 text-sm"
          />
        </div>
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {filteredProducts.map((p: any) => {
            const out = p.stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-right hover:bg-accent"
              >
                {p.image_url ? (
                  <img src={p.image_url} className="h-12 w-12 rounded object-cover" alt="" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name_ar || p.name_en}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{p.brand}</span>
                    <span>·</span>
                    <span className={out ? "text-destructive" : ""}>
                      {out ? (canOverrideStock ? "نفد — تجاوز متاح" : "نفد ✕") : `متوفر: ${p.stock}`}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-medium">{Number(p.price).toFixed(0)} ر.س</div>
              </button>
            );
          })}
          {filteredProducts.length === 0 && <p className="text-sm text-muted-foreground">لا توجد نتائج</p>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">السلة ({lines.length})</h2>
        {lines.length === 0 && <p className="mt-2 text-sm text-muted-foreground">لم يتم إضافة منتجات بعد.</p>}
        <div className="mt-3 space-y-2">
          {lines.map((l: Line, i: number) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-3">
                {l.image_url ? (
                  <img src={l.image_url} className="h-14 w-14 rounded object-cover" alt="" />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{l.product_name}</div>
                    <button onClick={() => removeLine(i)} className="text-destructive hover:opacity-80">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={l.size}
                      onChange={(e) => updateLine(i, { size: e.target.value })}
                      placeholder="مقاس"
                      className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
                    />
                    <input
                      value={l.color}
                      onChange={(e) => updateLine(i, { color: e.target.value })}
                      placeholder="لون"
                      className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
                    />
                    <div className="flex items-center gap-1 rounded border border-input">
                      <button onClick={() => updateLine(i, { qty: Math.max(1, l.qty - 1) })} className="px-2 py-1"><Minus className="h-3 w-3" /></button>
                      <input
                        type="number" min={1} value={l.qty}
                        onChange={(e) => updateLine(i, { qty: Math.max(1, Number(e.target.value)) })}
                        className="w-12 bg-background py-1 text-center text-xs outline-none"
                      />
                      <button onClick={() => updateLine(i, { qty: l.qty + 1 })} className="px-2 py-1"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="ms-auto text-sm font-semibold">
                      {l.is_free ? <span className="text-emerald-600">مجاني</span> : `${(l.qty * l.unit_price * (1 - (l.discount_pct ?? 0) / 100)).toFixed(2)} ر.س`}
                    </div>
                  </div>
                  {/* Manager-only line actions */}
                  {(canDiscount) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <input
                          type="number" min={0} max={100}
                          value={l.discount_pct ?? 0}
                          onChange={(e) => updateLine(i, { discount_pct: Math.min(100, Math.max(0, Number(e.target.value))) })}
                          disabled={l.is_free}
                          className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                          placeholder="%"
                        />
                        <span className="text-xs text-muted-foreground">% خصم</span>
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox" checked={!!l.is_free}
                          onChange={(e) => updateLine(i, { is_free: e.target.checked })}
                        />
                        <Gift className="h-3 w-3" /> مجاني
                      </label>
                      {l.override_stock && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          تجاوز مخزون
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============= Step 3: Shipping =============
function ShippingStep({
  address, setAddress, coords, setCoords,
  carrier, setCarrier, shippingFeeOverride, setShippingFeeOverride, baseShipping,
  warehouse, setWarehouse, deliveryWindow, setDeliveryWindow,
  deliveryNotes, setDeliveryNotes, canDiscount,
}: any) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">العنوان</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="المدينة *" value={address.city} onChange={(v: string) => setAddress({ ...address, city: v })} />
          <Field label="الحي" value={address.district} onChange={(v: string) => setAddress({ ...address, district: v })} />
          <Field label="الشارع" value={address.street} onChange={(v: string) => setAddress({ ...address, street: v })} className="sm:col-span-2" />
          <Field label="رقم المبنى" value={address.building} onChange={(v: string) => setAddress({ ...address, building: v })} />
          <Field label="الرمز البريدي" value={address.postalCode} onChange={(v: string) => setAddress({ ...address, postalCode: v })} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold"><MapPin className="h-4 w-4" /> الموقع على الخريطة</h2>
        <div className="mt-3">
          <LocationPicker
            value={coords}
            onChange={(loc: ResolvedLocation) => {
              setCoords({ lat: loc.lat, lng: loc.lng });
              setAddress((a: any) => ({
                ...a,
                city: a.city || loc.city || "",
                district: a.district || loc.district || "",
                street: a.street || loc.street || "",
                postalCode: a.postalCode || loc.postalCode || "",
              }));
            }}
            isRTL
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">الشحن</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">شركة الشحن</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as Carrier)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(CARRIER_LABEL) as Carrier[]).map((c) => (
                <option key={c} value={c}>{CARRIER_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">المستودع</label>
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="main">المستودع الرئيسي</option>
              <option value="riyadh">الرياض</option>
              <option value="jeddah">جدة</option>
              <option value="dammam">الدمام</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">تكلفة الشحن (تلقائي: {baseShipping} ر.س)</label>
            <input
              type="number" min={0}
              value={shippingFeeOverride ?? ""}
              onChange={(e) => setShippingFeeOverride(e.target.value === "" ? null : Number(e.target.value))}
              disabled={!canDiscount}
              placeholder={`${baseShipping}`}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            {!canDiscount && <p className="mt-1 text-[10px] text-muted-foreground">يحتاج صلاحية مدير</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">وقت التوصيل</label>
            <select
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— غير محدد —</option>
              <option value="morning">صباحاً (8-12)</option>
              <option value="afternoon">ظهراً (12-4)</option>
              <option value="evening">مساءً (4-9)</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">ملاحظات التوصيل</label>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="مثال: اتصل قبل الوصول"
          />
        </div>
      </div>
    </>
  );
}

// ============= Step 4: Payment =============
function PaymentStep({
  paymentMethod, setPaymentMethod, paymentReference, setPaymentReference,
  splitPayment, setSplitPayment, splitAmount, setSplitAmount, total, canManualPayment,
}: any) {
  const options: { id: PaymentChoice; label: string; description: string; needsManager?: boolean }[] = [
    { id: "cod", label: "الدفع عند الاستلام", description: "العميل يدفع عند استلام الطلب" },
    { id: "payment_link", label: "إرسال رابط دفع", description: "يُرسل رابط Stripe/Apple Pay للعميل (يبقى Pending)" },
    { id: "bank_transfer", label: "تحويل بنكي", description: "العميل يحوّل ويرسل الإيصال" },
    { id: "manual", label: "تسجيل دفع يدوي", description: "تسجيل دفع تم بالفعل (نقدي/POS)", needsManager: true },
    { id: "store_credit", label: "رصيد العميل", description: "خصم من رصيد المتجر" },
  ];
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">طريقة الدفع</h2>
        <div className="mt-3 grid gap-2">
          {options.map((opt) => {
            const blocked = opt.needsManager && !canManualPayment;
            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  paymentMethod === opt.id ? "border-primary bg-primary/5" : "border-border"
                } ${blocked ? "opacity-50" : ""}`}
              >
                <input
                  type="radio" name="payment" value={opt.id}
                  checked={paymentMethod === opt.id}
                  disabled={blocked}
                  onChange={() => setPaymentMethod(opt.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                  {blocked && <div className="mt-1 text-[10px] text-amber-600">يحتاج صلاحية مدير</div>}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {(paymentMethod === "manual" || paymentMethod === "bank_transfer") && (
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground">مرجع الدفع (رقم العملية / الإيصال)</label>
          <input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="مثال: TXN-12345"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={splitPayment} onChange={(e) => setSplitPayment(e.target.checked)} />
          <span>تقسيم الدفع</span>
        </label>
        {splitPayment && (
          <div className="mt-3 grid gap-2">
            <div className="text-xs text-muted-foreground">إجمالي: {total.toFixed(2)} ر.س</div>
            <input
              type="number" min={0} max={total}
              value={splitAmount}
              onChange={(e) => setSplitAmount(Number(e.target.value))}
              placeholder="المبلغ الأول"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">المتبقي: {(total - splitAmount).toFixed(2)} ر.س</div>
          </div>
        )}
      </div>
    </>
  );
}

// ============= Step 5: Review =============
function ReviewStep({
  orderType, customer, address, coords, lines,
  subtotalGross, discountTotal, subtotal, shipping_fee, tax, total,
  carrier, paymentMethod, customerNotes, internalNote, setInternalNote, whatsappLink,
}: any) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">مراجعة الطلب</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SummaryBlock title="العميل">
            <div>{customer.name}</div>
            <div className="text-muted-foreground">{customer.phone}</div>
            <div className="text-muted-foreground">{customer.email || "—"}</div>
          </SummaryBlock>
          <SummaryBlock title="العنوان">
            <div>{address.city} — {address.district}</div>
            <div className="text-muted-foreground">{address.street} {address.building}</div>
            {coords && <div className="text-xs text-muted-foreground">📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>}
          </SummaryBlock>
          <SummaryBlock title="الشحن">
            <div>{CARRIER_LABEL[carrier as Carrier]}</div>
          </SummaryBlock>
          <SummaryBlock title="الدفع">
            <div>
              {paymentMethod === "cod" ? "عند الاستلام" :
               paymentMethod === "card" ? "بطاقة" :
               paymentMethod === "payment_link" ? "رابط دفع" :
               paymentMethod === "bank_transfer" ? "تحويل بنكي" :
               paymentMethod === "manual" ? "يدوي (مدفوع)" :
               paymentMethod === "store_credit" ? "رصيد العميل" : paymentMethod}
            </div>
          </SummaryBlock>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="text-sm font-semibold">المنتجات</div>
          <div className="mt-2 space-y-1 text-sm">
            {lines.map((l: Line, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <span>{l.product_name} ({l.size}/{l.color}) × {l.qty}</span>
                <span>{l.is_free ? "مجاني" : `${(l.qty * l.unit_price * (1 - (l.discount_pct ?? 0) / 100)).toFixed(2)}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          <Row label="قبل الخصم" value={subtotalGross.toFixed(2)} />
          {discountTotal > 0 && <Row label="الخصم" value={`-${discountTotal.toFixed(2)}`} className="text-emerald-600" />}
          <Row label="الشحن" value={shipping_fee === 0 ? "مجاني" : shipping_fee.toFixed(2)} />
          <Row label="الضريبة (15%)" value={tax.toFixed(2)} />
          <Row label="الإجمالي" value={`${total.toFixed(2)} SAR`} bold />
        </div>

        {customerNotes && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">ملاحظات العميل</div>
            <div className="mt-1 text-sm">{customerNotes}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">ملاحظات داخلية</label>
        <textarea
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="ملاحظة للفريق فقط — لا تظهر للعميل"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">إرسال للعميل (بعد الإنشاء)</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={whatsappLink()} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            <MessageCircle className="h-3.5 w-3.5" /> واتساب
          </a>
          {customer.email && (
            <a
              href={`mailto:${customer.email}?subject=${encodeURIComponent("تأكيد طلبك")}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Mail className="h-3.5 w-3.5" /> إيميل
            </a>
          )}
          <a
            href={`tel:${customer.phone}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            <Phone className="h-3.5 w-3.5" /> اتصال
          </a>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">SMS تلقائي يحتاج تكامل لاحق</p>
      </div>
    </>
  );
}

// ============= Helpers =============
function Field({ label, value, onChange, className = "" }: any) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function Row({ label, value, bold, className = "" }: any) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""} ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
