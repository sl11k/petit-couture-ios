import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Truck,
  User,
  Wallet,
  Apple,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBag } from "@/state/BagContext";
import { useAddress, type Address } from "@/state/AddressContext";
import { db } from "@/lib/db";
import { trackServerEvent, getCurrentSessionId } from "@/lib/serverAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { placeOrder } from "@/server/placeOrder";

// Map only loads on the client when entering step 2.
const LocationPicker = lazy(
  () => import("@/components/checkout/LocationPicker"),
);

export const Route = createFileRoute("/checkout")({
  head: () =>
    buildMeta({
      title: "إتمام الطلب — Le Petit Paradis",
      description:
        "أكمل طلبك بأمان: بيانات التواصل، موقع التوصيل، ودفع آمن في خطوات قليلة.",
      path: "/checkout",
      noindex: true,
    }),
  component: CheckoutPage,
});

const phoneRegex = /^(?:\+9665\d{8}|009665\d{8}|05\d{8})$/;

type Step = 1 | 2 | 3 | 4;
type PayMethod = "card" | "apple_pay" | "bank_transfer" | "cod" | "tabby" | "tamara";

const SHIPPING_METHODS: Array<{
  id: string;
  label_ar: string;
  label_en: string;
  eta_ar: string;
  eta_en: string;
  fee: number;
}> = [
  { id: "standard", label_ar: "توصيل قياسي", label_en: "Standard", eta_ar: "٣–٥ أيام عمل", eta_en: "3–5 business days", fee: 25 },
  { id: "express", label_ar: "توصيل سريع", label_en: "Express", eta_ar: "خلال ٢٤ ساعة", eta_en: "Within 24 hours", fee: 45 },
  { id: "pickup", label_ar: "استلام من الفرع", label_en: "Store pickup", eta_ar: "جاهز خلال ساعتين", eta_en: "Ready in 2 hours", fee: 0 },
];

const FREE_SHIPPING_THRESHOLD = 500;
const TAX_RATE = 0.15;

function CheckoutPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { isRTL, lang } = useLanguage();
  const bag = useBag();
  const { address, save } = useAddress();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });

  const bagEmpty = bag.items.length === 0;

  // ───── Form state (single source of truth across steps) ─────
  const [step, setStep] = useState<Step>(1);
  const [contact, setContact] = useState({
    fullName: address?.fullName ?? "",
    email: address?.email ?? "",
    phone: address?.phone ?? "",
    createAccount: false,
  });
  const [loc, setLoc] = useState<{
    lat?: number;
    lng?: number;
    geoAddress?: string;
    city?: string;
    district?: string;
    street?: string;
    postalCode?: string;
  }>(() => ({
    lat: address?.lat,
    lng: address?.lng,
    geoAddress: address?.geoAddress,
    city: address?.city,
    district: address?.district,
    street: address?.street,
    postalCode: address?.postalCode,
  }));
  const [buildingNumber, setBuildingNumber] = useState(address?.buildingNumber ?? "");
  const [notes, setNotes] = useState(address?.notes ?? "");
  const [shippingId, setShippingId] = useState<string>("standard");
  const [payment, setPayment] = useState<PayMethod>("card");
  const [agree, setAgree] = useState(false);
  const [placing, setPlacing] = useState(false);
  const placedRef = useRef(false);

  // Redirect if bag empty
  const arrivedEmptyRef = useRef<boolean>(bagEmpty);
  useEffect(() => {
    if (bagEmpty && arrivedEmptyRef.current) navigate({ to: "/bag" });
  }, [bagEmpty, navigate]);

  // ───── Pricing ─────
  const shipping = useMemo(() => {
    const sel = SHIPPING_METHODS.find((m) => m.id === shippingId) ?? SHIPPING_METHODS[0];
    const fee = bag.subtotal >= FREE_SHIPPING_THRESHOLD && sel.id === "standard" ? 0 : sel.fee;
    return { ...sel, fee };
  }, [shippingId, bag.subtotal]);

  const pricing = useMemo(() => {
    const subtotal = bag.subtotal;
    const shipping_fee = shipping.fee;
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = subtotal + shipping_fee + tax;
    return { subtotal, shipping_fee, tax, total };
  }, [bag.subtotal, shipping.fee]);

  // ───── Validation per step ─────
  const errs = useMemo(() => {
    const e: Record<string, string> = {};
    if (step >= 1) {
      if (contact.fullName.trim().length < 2)
        e.fullName = isRTL ? "الاسم مطلوب" : "Full name required";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email))
        e.email = isRTL ? "بريد غير صحيح" : "Invalid email";
      if (!phoneRegex.test(contact.phone.replace(/[\s-]/g, "")))
        e.phone = isRTL ? "رقم جوال سعودي غير صحيح" : "Invalid Saudi phone";
    }
    if (step >= 2) {
      if (shipping.id !== "pickup") {
        if (loc.lat == null || loc.lng == null)
          e.location = isRTL ? "حدّد موقعك على الخريطة" : "Set your location on the map";
        if (!loc.city) e.city = isRTL ? "المدينة مطلوبة" : "City required";
      }
    }
    if (step >= 3) {
      if (!shippingId) e.shipping = isRTL ? "اختر طريقة الشحن" : "Select shipping";
    }
    if (step === 4 && !agree) {
      e.agree = isRTL ? "يجب الموافقة على الشروط" : "Please accept the terms";
    }
    return e;
  }, [step, contact, loc, shipping.id, shippingId, agree, isRTL]);

  const canProceed = (s: Step) => {
    if (s === 1) return !errs.fullName && !errs.email && !errs.phone;
    if (s === 2) return shipping.id === "pickup" || (!errs.location && !errs.city);
    if (s === 3) return !errs.shipping;
    return !errs.agree;
  };

  // ───── Begin checkout analytics + abandoned cart snapshot ─────
  const beganRef = useRef(false);
  useEffect(() => {
    if (bagEmpty || beganRef.current) return;
    beganRef.current = true;
    const session_id = getCurrentSessionId();
    void trackServerEvent("begin_checkout", {
      item_count: bag.count,
      currency: bag.currency,
      subtotal: pricing.subtotal,
      shipping_fee: pricing.shipping_fee,
      tax: pricing.tax,
      total: pricing.total,
      shipping_method: shipping.id,
      payment_method: payment,
    });
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        await db.from("abandoned_carts").upsert(
          {
            session_id,
            user_id: auth.user?.id ?? null,
            email: auth.user?.email ?? contact.email ?? null,
            items: bag.items,
            subtotal: pricing.subtotal,
            currency: bag.currency,
            reached_checkout: true,
            converted: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" },
        );
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagEmpty]);

  // ───── Step navigation ─────
  const next = () => {
    if (!canProceed(step)) {
      const first = Object.values(errs)[0];
      if (first) toast.error(first);
      return;
    }
    // Persist address as we go
    save({
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: contact.phone.replace(/[\s-]/g, ""),
      city: loc.city ?? "",
      district: loc.district,
      street: loc.street,
      postalCode: loc.postalCode,
      buildingNumber: buildingNumber || undefined,
      notes: notes || undefined,
      lat: loc.lat,
      lng: loc.lng,
      geoAddress: loc.geoAddress,
    } as Address);
    setStep((s) => (Math.min(4, s + 1) as Step));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const prev = () => {
    if (step === 1) {
      router.history.back();
      return;
    }
    setStep((s) => (Math.max(1, s - 1) as Step));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ───── Place order ─────
  const onPlaceOrder = async () => {
    if (bagEmpty || placing || placedRef.current) return;
    if (!canProceed(4)) {
      toast.error(errs.agree ?? (isRTL ? "أكمل البيانات" : "Complete the form"));
      return;
    }
    setPlacing(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const fullAddress: Address = {
        fullName: contact.fullName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.replace(/[\s-]/g, ""),
        city: loc.city ?? "",
        district: loc.district,
        street: loc.street,
        postalCode: loc.postalCode,
        buildingNumber: buildingNumber || undefined,
        notes: notes || undefined,
        lat: loc.lat,
        lng: loc.lng,
        geoAddress: loc.geoAddress,
      };
      save(fullAddress);

      const { order, duplicate } = await placeOrder({
        data: {
          session_id: getCurrentSessionId(),
          user_id: auth.user?.id ?? null,
          items: bag.items.map((it) => ({
            slug: it.slug,
            name: it.name,
            brand: it.brand ?? null,
            image: it.image ?? null,
            price: it.price,
            qty: it.qty,
            size: it.size ?? null,
            color: it.color ?? null,
          })),
          address: fullAddress as Record<string, unknown> as never,
          currency: bag.currency,
          payment_method: payment,
          pricing: {
            ...pricing,
            shipping_method: shipping.id,
          },
        },
      });

      if (!duplicate) {
        void trackServerEvent("purchase", {
          order_id: order.id,
          order_number: order.order_number,
          item_count: bag.count,
          currency: bag.currency,
          ...pricing,
          shipping_method: shipping.id,
          payment_method: payment,
        });
      }

      placedRef.current = true;

      // Tabby: create session and redirect to hosted checkout
      if (payment === "tabby") {
        try {
          const { createTabbyCheckout } = await import("@/lib/tabby.functions");
          const origin = window.location.origin;
          const result = await createTabbyCheckout({
            data: {
              order_id: order.id,
              success_url: `${origin}/order-confirmation/${order.order_number}?tabby=success`,
              cancel_url: `${origin}/checkout?tabby=cancel`,
              failure_url: `${origin}/checkout?tabby=failure`,
              lang: isRTL ? "ar" : "en",
            },
          });
          if (result.ok) {
            bag.clear();
            window.location.href = result.web_url;
            return;
          }
          toast.error(result.message);
          setPlacing(false);
          return;
        } catch (err) {
          console.error("Tabby checkout error", err);
          toast.error(isRTL ? "تعذّر بدء دفع تابي" : "Could not start Tabby checkout");
          setPlacing(false);
          return;
        }
      }

      // Tamara: create session and redirect to hosted checkout
      if (payment === "tamara") {
        try {
          const { createTamaraCheckout } = await import("@/lib/tamara.functions");
          const origin = window.location.origin;
          const result = await createTamaraCheckout({
            data: {
              order_id: order.id,
              success_url: `${origin}/order-confirmation/${order.order_number}?tamara=success`,
              cancel_url: `${origin}/checkout?tamara=cancel`,
              failure_url: `${origin}/checkout?tamara=failure`,
              notification_url: `${origin}/api/public/tamara-webhook`,
              lang: isRTL ? "ar" : "en",
            },
          });
          if (result.ok) {
            bag.clear();
            window.location.href = result.checkout_url;
            return;
          }
          toast.error(result.message);
          setPlacing(false);
          return;
        } catch (err) {
          console.error("Tamara checkout error", err);
          toast.error(isRTL ? "تعذّر بدء دفع تمارا" : "Could not start Tamara checkout");
          setPlacing(false);
          return;
        }
      }

      bag.clear();
      navigate({
        to: "/order-confirmation/$orderNumber",
        params: { orderNumber: order.order_number },
      });
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? "تعذّر إنشاء الطلب" : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  const fieldClass = (hasError?: boolean) =>
    [
      "w-full h-[52px] rounded-[16px] bg-cream-warm/40 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/70 tracking-soft outline-none transition border",
      hasError ? "border-destructive/60" : "border-border focus:border-gold",
    ].join(" ");

  // ───── UI ─────
  const stepLabels = lang === "ar"
    ? ["معلوماتك", "العنوان", "الشحن والدفع", "المراجعة"]
    : ["Your info", "Address", "Shipping & Pay", "Review"];

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[460px] bg-background min-h-screen shadow-soft">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/60 px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            aria-label={isRTL ? "رجوع" : "Back"}
            onClick={prev}
            className="h-10 w-10 -ms-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition"
          >
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {isRTL ? "إتمام الطلب" : "CHECKOUT"}
          </span>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            {isRTL ? "آمن" : "Secure"}
          </span>
        </header>

        {/* Step indicator */}
        <div className="px-5 pt-4">
          <ol className="flex items-center gap-1.5">
            {stepLabels.map((label, i) => {
              const n = (i + 1) as Step;
              const active = n === step;
              const done = n < step;
              return (
                <li key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={[
                      "h-1 w-full rounded-full transition-all",
                      done ? "bg-gold" : active ? "bg-foreground" : "bg-border",
                    ].join(" ")}
                  />
                  <span
                    className={[
                      "text-[9.5px] tracking-luxury transition-colors text-center leading-tight",
                      active || done ? "text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <main className="px-5 pt-6 pb-[200px]">
          {/* ───── STEP 1: Contact ───── */}
          {step === 1 && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h1 className="font-serif text-[26px] leading-tight text-foreground">
                  {isRTL ? "معلومات التواصل" : "Contact information"}
                </h1>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {isRTL ? "نحتاجها لإرسال تفاصيل طلبك وتأكيد التوصيل" : "Used to send your order details and confirm delivery"}
                </p>
              </div>

              <Field icon={<User className="h-4 w-4" />} label={isRTL ? "الاسم الكامل" : "Full name"} error={errs.fullName}>
                <input
                  className={fieldClass(!!errs.fullName)}
                  value={contact.fullName}
                  onChange={(e) => setContact({ ...contact, fullName: e.target.value })}
                  placeholder={isRTL ? "مثال: ليلى المنصور" : "e.g. Layla Al-Mansour"}
                  autoComplete="name"
                />
              </Field>
              <Field icon={<Phone className="h-4 w-4" />} label={isRTL ? "رقم الجوال" : "Mobile number"} error={errs.phone}>
                <input
                  className={fieldClass(!!errs.phone)}
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                />
              </Field>
              <Field icon={<Mail className="h-4 w-4" />} label={isRTL ? "البريد الإلكتروني" : "Email"} error={errs.email}>
                <input
                  className={fieldClass(!!errs.email)}
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="you@example.com"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                />
              </Field>

              <label className="flex items-start gap-3 p-3 rounded-[14px] bg-cream-warm/40 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-foreground"
                  checked={contact.createAccount}
                  onChange={(e) => setContact({ ...contact, createAccount: e.target.checked })}
                />
                <span className="text-[12.5px] text-foreground/80 leading-snug">
                  {isRTL ? "أنشئ حساباً بعد إكمال الطلب لتتبع الطلبات وحفظ العناوين" : "Create an account after this order to track orders and save addresses"}
                </span>
              </label>

              <p className="text-[11px] text-muted-foreground text-center">
                {isRTL ? "أو يمكنك إكمال الطلب كزائر — لا حاجة لحساب." : "Or check out as guest — no account needed."}
              </p>
            </section>
          )}

          {/* ───── STEP 2: Address + Map ───── */}
          {step === 2 && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h1 className="font-serif text-[26px] leading-tight text-foreground">
                  {isRTL ? "عنوان التوصيل" : "Delivery address"}
                </h1>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {isRTL ? "حدّد موقعك على الخريطة لتوصيل أسرع وأدق" : "Set your location on the map for faster, accurate delivery"}
                </p>
              </div>

              <Suspense
                fallback={
                  <div className="h-[260px] rounded-[18px] bg-cream-warm/40 grid place-items-center border border-border">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <LocationPicker
                  isRTL={isRTL}
                  value={loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null}
                  onChange={(r) => setLoc((p) => ({ ...p, ...r }))}
                />
              </Suspense>

              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "المدينة" : "City"} error={errs.city}>
                  <input
                    className={fieldClass(!!errs.city)}
                    value={loc.city ?? ""}
                    onChange={(e) => setLoc({ ...loc, city: e.target.value })}
                    placeholder={isRTL ? "الرياض" : "Riyadh"}
                  />
                </Field>
                <Field label={isRTL ? "الحي" : "District"}>
                  <input
                    className={fieldClass(false)}
                    value={loc.district ?? ""}
                    onChange={(e) => setLoc({ ...loc, district: e.target.value })}
                    placeholder={isRTL ? "العليا" : "Al Olaya"}
                  />
                </Field>
              </div>
              <Field label={isRTL ? "اسم الشارع" : "Street"}>
                <input
                  className={fieldClass(false)}
                  value={loc.street ?? ""}
                  onChange={(e) => setLoc({ ...loc, street: e.target.value })}
                  placeholder={isRTL ? "شارع الأمير محمد" : "Prince Mohammed St."}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "رقم المبنى" : "Building no."}>
                  <input
                    className={fieldClass(false)}
                    value={buildingNumber}
                    onChange={(e) => setBuildingNumber(e.target.value)}
                    placeholder="1234"
                    inputMode="numeric"
                  />
                </Field>
                <Field label={isRTL ? "الرمز البريدي" : "Postal code"}>
                  <input
                    className={fieldClass(false)}
                    value={loc.postalCode ?? ""}
                    onChange={(e) => setLoc({ ...loc, postalCode: e.target.value })}
                    placeholder="12345"
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <Field label={isRTL ? "ملاحظات للمندوب (اختياري)" : "Delivery notes (optional)"}>
                <textarea
                  className="w-full min-h-[72px] rounded-[16px] bg-cream-warm/40 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 outline-none border border-border focus:border-gold resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRTL ? "بجانب البقالة، الباب الخلفي…" : "Next to the grocery, back door…"}
                  rows={3}
                  maxLength={240}
                />
              </Field>
            </section>
          )}

          {/* ───── STEP 3: Shipping + Payment ───── */}
          {step === 3 && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h1 className="font-serif text-[26px] leading-tight text-foreground">
                  {isRTL ? "الشحن والدفع" : "Shipping & payment"}
                </h1>
              </div>

              {/* Shipping options */}
              <div>
                <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-3 inline-flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  {isRTL ? "طريقة التوصيل" : "DELIVERY METHOD"}
                </h2>
                <div className="space-y-2">
                  {SHIPPING_METHODS.map((m) => {
                    const isFree = bag.subtotal >= FREE_SHIPPING_THRESHOLD && m.id === "standard";
                    const fee = isFree ? 0 : m.fee;
                    const active = shippingId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setShippingId(m.id)}
                        className={[
                          "w-full text-start p-4 rounded-[16px] border transition flex items-center gap-3",
                          active ? "border-gold bg-gold/5 shadow-sm" : "border-border bg-cream-warm/30",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "h-5 w-5 shrink-0 rounded-full border-2 grid place-items-center transition",
                            active ? "border-gold" : "border-border",
                          ].join(" ")}
                        >
                          {active && <div className="h-2.5 w-2.5 rounded-full bg-gold" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] text-foreground font-medium">
                            {lang === "ar" ? m.label_ar : m.label_en}
                          </div>
                          <div className="text-[11.5px] text-muted-foreground mt-0.5">
                            {lang === "ar" ? m.eta_ar : m.eta_en}
                          </div>
                        </div>
                        <div className="text-[13px] tracking-soft">
                          {fee === 0 ? (
                            <span className="text-emerald-700 font-medium">
                              {isRTL ? "مجاني" : "FREE"}
                            </span>
                          ) : (
                            <span>{fmt(fee)} {isRTL ? "ر.س" : "SAR"}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment methods */}
              <div>
                <h2 className="text-[10.5px] tracking-luxury text-muted-foreground mb-3 inline-flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  {isRTL ? "طريقة الدفع" : "PAYMENT METHOD"}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <PayOption
                    active={payment === "card"}
                    onClick={() => setPayment("card")}
                    icon={<CreditCard className="h-4 w-4" />}
                    label={isRTL ? "بطاقة ائتمان" : "Credit card"}
                    sub={isRTL ? "Visa · Mastercard · مدى" : "Visa · Mastercard · mada"}
                  />
                  <PayOption
                    active={payment === "apple_pay"}
                    onClick={() => setPayment("apple_pay")}
                    icon={<Apple className="h-4 w-4" />}
                    label="Apple Pay"
                    sub={isRTL ? "دفع سريع وآمن" : "Fast & secure"}
                  />
                  <PayOption
                    active={payment === "bank_transfer"}
                    onClick={() => setPayment("bank_transfer")}
                    icon={<Landmark className="h-4 w-4" />}
                    label={isRTL ? "تحويل بنكي" : "Bank transfer"}
                    sub={isRTL ? "تعليمات بعد الطلب" : "Instructions after order"}
                  />
                  <PayOption
                    active={payment === "cod"}
                    onClick={() => setPayment("cod")}
                    icon={<Wallet className="h-4 w-4" />}
                    label={isRTL ? "الدفع عند الاستلام" : "Cash on delivery"}
                    sub={isRTL ? "ادفع للمندوب" : "Pay the courier"}
                  />
                  <PayOption
                    active={payment === "tabby"}
                    onClick={() => setPayment("tabby")}
                    icon={<span className="text-[11px] font-bold tracking-wide">tabby</span>}
                    label={isRTL ? "قسّمها على 4 — تابي" : "Split in 4 — Tabby"}
                    sub={isRTL ? "بدون فوائد ولا رسوم" : "0% interest, no fees"}
                  />
                  <PayOption
                    active={payment === "tamara"}
                    onClick={() => setPayment("tamara")}
                    icon={<span className="text-[11px] font-bold tracking-wide">tamara</span>}
                    label={isRTL ? "قسّمها على 4 — تمارا" : "Split in 4 — Tamara"}
                    sub={isRTL ? "بدون فوائد ولا رسوم" : "0% interest, no fees"}
                  />
                </div>

                {payment === "tabby" && (
                  <div className="mt-3 p-3 rounded-[12px] bg-cream-warm/40 border border-border text-[12px] text-foreground/80 leading-relaxed">
                    {isRTL
                      ? "ستُحوَّل لبوابة تابي لإتمام الدفع على 4 دفعات بدون فوائد."
                      : "You'll be redirected to Tabby to pay in 4 interest-free installments."}
                  </div>
                )}

                {payment === "tamara" && (
                  <div className="mt-3 p-3 rounded-[12px] bg-cream-warm/40 border border-border text-[12px] text-foreground/80 leading-relaxed">
                    {isRTL
                      ? "ستُحوَّل لبوابة تمارا لإتمام الدفع على 4 دفعات بدون فوائد."
                      : "You'll be redirected to Tamara to pay in 4 interest-free installments."}
                  </div>
                )}

                {payment === "bank_transfer" && (
                  <div className="mt-3 p-3 rounded-[12px] bg-cream-warm/40 border border-border text-[12px] text-foreground/80 leading-relaxed">
                    {isRTL
                      ? "ستتلقى تفاصيل الحساب البنكي ورقم الطلب عبر البريد. يبقى الطلب معلقاً حتى تأكيد الإدارة للتحويل."
                      : "You'll receive bank account details and your order number by email. Order stays pending until we confirm the transfer."}
                  </div>
                )}
                {payment === "cod" && (
                  <div className="mt-3 p-3 rounded-[12px] bg-cream-warm/40 border border-border text-[12px] text-foreground/80 leading-relaxed">
                    {isRTL
                      ? "جهّز المبلغ نقداً عند استلام الطلب من المندوب. قد تطبّق رسوم خدمة بسيطة."
                      : "Have the cash ready when the courier arrives. A small service fee may apply."}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ───── STEP 4: Review ───── */}
          {step === 4 && (
            <section className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h1 className="font-serif text-[26px] leading-tight text-foreground">
                  {isRTL ? "مراجعة الطلب" : "Review your order"}
                </h1>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {isRTL ? "تأكد من التفاصيل قبل التأكيد" : "Confirm everything before placing the order"}
                </p>
              </div>

              {/* Items */}
              <ReviewBlock
                title={isRTL ? `المنتجات (${bag.count})` : `Items (${bag.count})`}
                onEdit={() => navigate({ to: "/bag" })}
                editLabel={isRTL ? "تعديل" : "Edit"}
              >
                <ul className="space-y-2.5">
                  {bag.items.map((it, i) => (
                    <li key={i} className="flex gap-3">
                      {it.image ? (
                        <img src={it.image} alt={it.name} className="h-14 w-14 rounded-[10px] object-cover bg-cream-warm" />
                      ) : (
                        <div className="h-14 w-14 rounded-[10px] bg-cream-warm" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-foreground line-clamp-1">{it.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {[it.size, it.color, `×${it.qty}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="text-[12.5px] tracking-soft">
                        {fmt(it.price * it.qty)} {isRTL ? "ر.س" : "SAR"}
                      </div>
                    </li>
                  ))}
                </ul>
              </ReviewBlock>

              {/* Contact */}
              <ReviewBlock
                title={isRTL ? "التواصل" : "Contact"}
                onEdit={() => setStep(1)}
                editLabel={isRTL ? "تعديل" : "Edit"}
              >
                <div className="text-[13px] text-foreground">{contact.fullName}</div>
                <div className="text-[12px] text-muted-foreground">{contact.email}</div>
                <div className="text-[12px] text-muted-foreground" dir="ltr">{contact.phone}</div>
              </ReviewBlock>

              {/* Address */}
              <ReviewBlock
                title={isRTL ? "العنوان" : "Address"}
                onEdit={() => setStep(2)}
                editLabel={isRTL ? "تعديل" : "Edit"}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                  <div className="flex-1 text-[12.5px] text-foreground/90 leading-snug">
                    {loc.geoAddress ?? [loc.street, loc.district, loc.city].filter(Boolean).join("، ")}
                    {buildingNumber && (
                      <span className="block text-[11.5px] text-muted-foreground mt-0.5">
                        {isRTL ? "مبنى" : "Bldg."} {buildingNumber}
                      </span>
                    )}
                    {notes && (
                      <span className="block text-[11.5px] text-muted-foreground mt-1 italic">"{notes}"</span>
                    )}
                  </div>
                </div>
              </ReviewBlock>

              {/* Shipping + Payment */}
              <ReviewBlock
                title={isRTL ? "الشحن والدفع" : "Shipping & payment"}
                onEdit={() => setStep(3)}
                editLabel={isRTL ? "تعديل" : "Edit"}
              >
                <div className="flex items-center gap-2 text-[12.5px]">
                  <Truck className="h-4 w-4 text-gold" />
                  <span className="text-foreground">{lang === "ar" ? shipping.label_ar : shipping.label_en}</span>
                  <span className="text-muted-foreground">· {lang === "ar" ? shipping.eta_ar : shipping.eta_en}</span>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] mt-2">
                  {payment === "card" && <CreditCard className="h-4 w-4 text-gold" />}
                  {payment === "apple_pay" && <Apple className="h-4 w-4 text-gold" />}
                  {payment === "bank_transfer" && <Landmark className="h-4 w-4 text-gold" />}
                  {payment === "cod" && <Wallet className="h-4 w-4 text-gold" />}
                  {payment === "tabby" && <span className="text-[10px] font-bold text-gold">tabby</span>}
                  {payment === "tamara" && <span className="text-[10px] font-bold text-gold">tamara</span>}
                  <span className="text-foreground">
                    {payment === "card" && (isRTL ? "بطاقة ائتمان" : "Credit card")}
                    {payment === "apple_pay" && "Apple Pay"}
                    {payment === "bank_transfer" && (isRTL ? "تحويل بنكي" : "Bank transfer")}
                    {payment === "cod" && (isRTL ? "الدفع عند الاستلام" : "Cash on delivery")}
                    {payment === "tabby" && (isRTL ? "تابي — 4 دفعات" : "Tabby — 4 installments")}
                    {payment === "tamara" && (isRTL ? "تمارا — 4 دفعات" : "Tamara — 4 installments")}
                  </span>
                </div>
              </ReviewBlock>

              {/* Pricing breakdown */}
              <div className="rounded-[16px] border border-border bg-cream-warm/30 p-4 space-y-2">
                <Row label={isRTL ? "المجموع الفرعي" : "Subtotal"} value={`${fmt(pricing.subtotal)} ${isRTL ? "ر.س" : "SAR"}`} />
                <Row label={isRTL ? "الشحن" : "Shipping"} value={pricing.shipping_fee === 0 ? (isRTL ? "مجاني" : "FREE") : `${fmt(pricing.shipping_fee)} ${isRTL ? "ر.س" : "SAR"}`} />
                <Row label={isRTL ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"} value={`${fmt(pricing.tax)} ${isRTL ? "ر.س" : "SAR"}`} />
                <div className="h-px bg-border my-2" />
                <Row
                  label={<span className="font-medium text-foreground">{isRTL ? "الإجمالي" : "Total"}</span>}
                  value={
                    <span className="font-serif text-[18px] text-foreground">
                      {fmt(pricing.total)} {isRTL ? "ر.س" : "SAR"}
                    </span>
                  }
                />
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 p-3 rounded-[14px] bg-cream-warm/40 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-foreground"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span className="text-[12px] text-foreground/80 leading-snug">
                  {isRTL
                    ? "أوافق على الشروط والأحكام وسياسة الإرجاع والاستبدال"
                    : "I agree to the terms & conditions and the return policy"}
                </span>
              </label>

              <div className="flex items-center justify-center gap-4 text-[10.5px] tracking-luxury text-muted-foreground pt-2">
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{isRTL ? "دفع آمن" : "SECURE"}</span>
                <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" />{isRTL ? "بيانات مشفّرة" : "ENCRYPTED"}</span>
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{isRTL ? "ضمان رسمي" : "WARRANTY"}</span>
              </div>
            </section>
          )}
        </main>

        {/* ───── Sticky bottom bar ───── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="w-full max-w-[460px] bg-background/98 backdrop-blur-md border-t border-border px-5 pt-3 pb-5 pointer-events-auto shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.08)]">
            {step < 4 && (
              <div className="flex items-center justify-between mb-2 text-[12px]">
                <span className="text-muted-foreground">{isRTL ? "الإجمالي المؤقت" : "Estimated total"}</span>
                <span className="font-serif text-[16px] text-foreground">
                  {fmt(pricing.total)} {isRTL ? "ر.س" : "SAR"}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={placing || (step === 4 && !agree)}
              onClick={step < 4 ? next : onPlaceOrder}
              className={[
                "w-full h-[54px] rounded-[16px] font-medium tracking-soft text-[14px] transition flex items-center justify-center gap-2",
                "bg-foreground text-background active:scale-[0.99]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {placing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRTL ? "جاري إنشاء الطلب…" : "Placing order…"}
                </>
              ) : step < 4 ? (
                <>
                  {isRTL ? "متابعة" : "Continue"}
                  <ChevronRight className={isRTL ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {isRTL ? `تأكيد الطلب · ${fmt(pricing.total)} ر.س` : `Place order · ${fmt(pricing.total)} SAR`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── Helpers ─────

function Field({
  icon,
  label,
  error,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10.5px] tracking-luxury text-muted-foreground inline-flex items-center gap-1.5 mb-1.5">
        {icon}
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11.5px] text-destructive">{error}</p>}
    </div>
  );
}

function PayOption({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "p-3 rounded-[14px] border text-start transition relative",
        active ? "border-gold bg-gold/5 shadow-sm" : "border-border bg-cream-warm/30",
      ].join(" ")}
    >
      {active && (
        <Check className="absolute top-2 end-2 h-3.5 w-3.5 text-gold" />
      )}
      <div className="text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{sub}</div>
    </button>
  );
}

function ReviewBlock({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10.5px] tracking-luxury text-muted-foreground">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] text-foreground/70 inline-flex items-center gap-1 hover:text-foreground transition"
        >
          <Pencil className="h-3 w-3" />
          {editLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
