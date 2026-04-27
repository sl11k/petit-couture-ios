import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Lock, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBag } from "@/state/BagContext";
import { useAddress, type Address } from "@/state/AddressContext";
import { db } from "@/lib/db";
import { trackServerEvent, getCurrentSessionId } from "@/lib/serverAnalytics";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Maisonnét" },
      {
        name: "description",
        content:
          "Confirm your Saudi National Address and complete a secure checkout at Maisonnét.",
      },
      { property: "og:title", content: "Checkout — Maisonnét" },
      {
        property: "og:description",
        content: "Saudi National Address delivery and secure payment.",
      },
    ],
  }),
  component: CheckoutPage,
});

// Saudi formats:
// - Phone: +9665XXXXXXXX or 05XXXXXXXX (mobile)
// - National Address Short Code: 4 uppercase letters + 4 digits (e.g. RIYD2342)
// - Building / Additional number: 4 digits, Postal code: 5 digits
const phoneRegex = /^(?:\+9665\d{8}|009665\d{8}|05\d{8})$/;
const shortCodeRegex = /^[A-Z]{4}\d{4}$/;
const fourDigitRegex = /^\d{4}$/;
const fiveDigitRegex = /^\d{5}$/;

// Live-format helpers — keep raw value submission-friendly while improving readability as the user types.
// Phone: accepts +966…, 00966…, or local 05… and groups digits in luxury-friendly chunks.
function formatSaudiPhone(raw: string): string {
  // Strip everything except digits and a leading +
  const cleaned = raw.replace(/[^\d+]/g, "");
  let core = cleaned;
  let prefix = "";

  if (core.startsWith("+966")) {
    prefix = "+966 ";
    core = core.slice(4);
  } else if (core.startsWith("00966")) {
    prefix = "+966 ";
    core = core.slice(5);
  } else if (core.startsWith("+")) {
    // Unsupported country code while typing — keep the + and let validation flag it.
    prefix = "+";
    core = core.slice(1).replace(/\D/g, "");
  } else if (core.startsWith("0")) {
    // Local format 05XXXXXXXX → "05X XXX XXXX"
    const digits = core.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  } else {
    core = core.replace(/\D/g, "");
  }

  // International: 9 digits after +966 → "5X XXX XXXX"
  const digits = core.replace(/\D/g, "").slice(0, 9);
  if (digits.length === 0) return prefix.trimEnd();
  if (digits.length <= 2) return `${prefix}${digits}`;
  if (digits.length <= 5) return `${prefix}${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${prefix}${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

// Short code: 4 uppercase letters + 4 digits (e.g. RIYD2342). Accept letters in first 4 slots, digits after.
function formatShortCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let letters = "";
  let digits = "";
  for (const ch of cleaned) {
    if (letters.length < 4) {
      if (/[A-Z]/.test(ch)) letters += ch;
      // skip stray digits while letters slot is open
    } else if (digits.length < 4 && /\d/.test(ch)) {
      digits += ch;
    }
  }
  return letters + digits;
}

function buildSchema(e: ReturnType<typeof useLanguage>["t"]["checkout"]["errors"]) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: e.nameRequired })
      .max(80, { message: e.nameTooLong }),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(phoneRegex, { message: e.phoneInvalid })),
    email: z
      .string()
      .trim()
      .max(255)
      .email({ message: e.emailInvalid }),
    shortCode: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(shortCodeRegex, { message: e.shortCodeInvalid })),
    buildingNumber: z.string().trim().regex(fourDigitRegex, { message: e.buildingInvalid }),
    street: z.string().trim().min(2, { message: e.streetRequired }).max(120),
    district: z.string().trim().min(2, { message: e.districtRequired }).max(80),
    city: z.string().trim().min(2, { message: e.cityRequired }).max(60),
    postalCode: z.string().trim().regex(fiveDigitRegex, { message: e.postalInvalid }),
    additionalNumber: z
      .string()
      .trim()
      .regex(fourDigitRegex, { message: e.additionalInvalid }),
    notes: z
      .string()
      .trim()
      .max(240, { message: e.notesTooLong })
      .optional()
      .or(z.literal("")),
  });
}

function CheckoutPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { t, isRTL, lang } = useLanguage();
  const bag = useBag();
  const { address, save } = useAddress();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const fmt = (n: number) => n.toLocaleString(locale);
  const total = bag.subtotal;
  const bagEmpty = bag.items.length === 0;

  // Distinguish "arrived with empty bag" (silent redirect to /bag) vs
  // "bag became empty while on checkout" (calm toast + delayed redirect so the user sees it).
  const arrivedEmptyRef = useRef<boolean>(bagEmpty);
  const notifiedEmptyRef = useRef<boolean>(false);

  useEffect(() => {
    if (!bagEmpty) return;
    if (arrivedEmptyRef.current) {
      navigate({ to: "/bag" });
      return;
    }
    if (notifiedEmptyRef.current) return;
    notifiedEmptyRef.current = true;
    toast(t.checkout.bagEmptyDuringCheckout, {
      icon: "🛍️",
      position: isRTL ? "top-left" : "top-right",
      duration: 2600,
    });
    const id = window.setTimeout(() => navigate({ to: "/bag" }), 2400);
    return () => window.clearTimeout(id);
  }, [bagEmpty, navigate, t.checkout.bagEmptyDuringCheckout, isRTL]);

  // Track begin_checkout once per session-cart-signature; upsert abandoned cart by session_id.
  const BEGIN_KEY = "maisonnet:begin_checkout:v1";
  const beganRef = useRef(false);
  useEffect(() => {
    if (bagEmpty || beganRef.current) return;
    beganRef.current = true;

    const session_id = getCurrentSessionId();
    // Dedup begin_checkout per session+subtotal+count signature
    const signature = `${session_id}|${bag.count}|${bag.subtotal}`;
    let alreadyFired = false;
    try {
      alreadyFired = window.sessionStorage.getItem(BEGIN_KEY) === signature;
    } catch { /* ignore */ }

    if (!alreadyFired) {
      void trackServerEvent("begin_checkout", {
        item_count: bag.count,
        subtotal: bag.subtotal,
        currency: bag.currency,
      });
      try { window.sessionStorage.setItem(BEGIN_KEY, signature); } catch { /* ignore */ }
    }

    // Upsert abandoned cart snapshot (one row per session_id)
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        await db.from("abandoned_carts").upsert(
          {
            session_id,
            user_id: auth.user?.id ?? null,
            email: auth.user?.email ?? null,
            items: bag.items,
            subtotal: bag.subtotal,
            currency: bag.currency,
            reached_checkout: true,
            converted: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" },
        );
      } catch {
        /* ignore */
      }
    })();
  }, [bagEmpty, bag.count, bag.subtotal, bag.currency, bag.items]);

  const schema = buildSchema(t.checkout.errors);
  type FormValues = z.input<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      fullName: address?.fullName ?? "",
      phone: address?.phone ?? "",
      email: address?.email ?? "",
      shortCode: address?.shortCode ?? "",
      buildingNumber: address?.buildingNumber ?? "",
      street: address?.street ?? "",
      district: address?.district ?? "",
      city: address?.city ?? "",
      postalCode: address?.postalCode ?? "",
      additionalNumber: address?.additionalNumber ?? "",
      notes: address?.notes ?? "",
    },
  });

  // If no saved address, start in edit mode; otherwise review first.
  const [editing, setEditing] = useState<boolean>(!address);

  const onSubmit = (values: FormValues) => {
    if (bagEmpty) return;
    const parsed = schema.parse(values);
    save(parsed as Address);
    setEditing(false);
    toast.success(t.checkout.success);
  };

  const [placing, setPlacing] = useState(false);
  const onPlaceOrder = async () => {
    if (bagEmpty || !address || placing) return;
    setPlacing(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const subtotal = bag.subtotal;
      const shippingFee = subtotal >= 500 ? 0 : 25;
      const tax = Math.round(subtotal * 0.15 * 100) / 100;
      const totalAmount = subtotal + shippingFee + tax;

      const { data: order, error: orderErr } = await db
        .from("orders")
        .insert({
          user_id: auth.user?.id ?? null,
          customer_name: address.fullName,
          customer_email: address.email,
          customer_phone: address.phone,
          status: "pending",
          payment_method: "cod",
          subtotal,
          shipping_fee: shippingFee,
          tax,
          total: totalAmount,
          currency: bag.currency,
          shipping_address: address,
          notes: address.notes ?? null,
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr ?? new Error("Order failed");

      const items = bag.items.map((it) => ({
        order_id: order.id,
        product_slug: it.slug,
        product_name: it.name,
        brand: it.brand,
        image_url: it.image,
        unit_price: it.price,
        qty: it.qty,
        size: it.size,
        color: it.color,
        line_total: it.price * it.qty,
      }));
      await db.from("order_items").insert(items);

      // Mark abandoned cart converted
      await db
        .from("abandoned_carts")
        .update({ converted: true, updated_at: new Date().toISOString() })
        .eq("session_id", getCurrentSessionId());

      void trackServerEvent("purchase", {
        order_id: order.id,
        order_number: order.order_number,
        total: totalAmount,
        currency: bag.currency,
        item_count: bag.count,
      });

      toast.success(t.checkout.success);
      bag.clear();
      navigate({ to: "/", search: {} as never });
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? "تعذّر إنشاء الطلب" : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  const errors = form.formState.errors;

  // Live-confirmed address: when editing, derive from current form values via the
  // strict zod schema; when reviewing, fall back to the persisted saved address.
  const watched = form.watch();
  const confirmedAddress: Address | null = useMemo(() => {
    if (!editing) return address;
    const parsed = schema.safeParse(watched);
    return parsed.success ? (parsed.data as Address) : null;
  }, [editing, address, watched, schema]);

  const fieldClass = (hasError: boolean) =>
    [
      "w-full h-[52px] rounded-[16px] bg-cream-warm/40 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/70 tracking-soft outline-none transition border",
      hasError
        ? "border-destructive/60 focus:border-destructive"
        : "border-border focus:border-gold",
    ].join(" ");

  const labelClass = "text-[10.5px] tracking-luxury text-muted-foreground";
  const errorClass = "mt-1 text-[11.5px] text-destructive tracking-soft";

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* iOS status bar */}
        <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold text-foreground tracking-tight">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-[2px] border border-foreground/80" />
            <span className="text-[11px]">100%</span>
          </div>
        </div>

        {/* Header */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            aria-label={isRTL ? "رجوع" : "Back"}
            onClick={() => router.history.back()}
            className="h-10 w-10 -ms-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition"
          >
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {lang === "en" ? t.checkout.eyebrow : t.checkout.eyebrow}
          </span>
          <span className="h-10 w-10" />
        </header>

        <main className="pb-[160px]">
          <section className="px-5 pt-2">
            <h1 className="font-serif text-[30px] leading-tight text-foreground">
              {t.checkout.title}
            </h1>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground tracking-soft">
              {t.announcements[2]}
            </p>
          </section>

          {/* Step indicator */}
          <nav
            aria-label={t.checkout.steps.stepOf(editing ? 2 : 3, 3)}
            className="px-5 mt-6"
          >
            <ol className="flex items-center gap-2">
              {[
                { key: "bag", label: t.checkout.steps.bag, n: 1 },
                { key: "address", label: t.checkout.steps.address, n: 2 },
                { key: "payment", label: t.checkout.steps.payment, n: 3 },
              ].map((step, idx, arr) => {
                const activeStep = editing ? 2 : 3;
                const status: "done" | "active" | "upcoming" =
                  step.n < activeStep ? "done" : step.n === activeStep ? "active" : "upcoming";
                const isLast = idx === arr.length - 1;
                return (
                  <li key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-current={status === "active" ? "step" : undefined}
                        className={[
                          "h-7 w-7 shrink-0 grid place-items-center rounded-full text-[11px] font-medium tabular-nums transition",
                          status === "done"
                            ? "bg-gold-deep text-background"
                            : status === "active"
                              ? "bg-foreground text-background ring-4 ring-foreground/10"
                              : "bg-cream-warm text-muted-foreground border border-border",
                        ].join(" ")}
                      >
                        {status === "done" ? (
                          <Check className="h-[13px] w-[13px]" strokeWidth={2.2} />
                        ) : (
                          step.n.toLocaleString(locale)
                        )}
                      </span>
                      <span
                        className={[
                          "text-[11px] tracking-luxury truncate",
                          status === "active"
                            ? "text-foreground"
                            : status === "done"
                              ? "text-gold-deep"
                              : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {lang === "en" ? step.label.toUpperCase() : step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={[
                          "flex-1 h-px mx-2 transition",
                          step.n < activeStep ? "bg-gold-deep/60" : "bg-border",
                        ].join(" ")}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="px-5 mt-7 space-y-7"
          >
            {/* Saved address review (when address exists and not editing) */}
            {address && !editing && (
              <section className="rounded-[20px] border border-gold-soft bg-cream-warm/30 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-[15px] w-[15px] text-gold-deep" strokeWidth={1.6} />
                    <span className="text-[10.5px] tracking-luxury text-gold-deep">
                      {lang === "en"
                        ? t.checkout.savedEyebrow
                        : t.checkout.savedEyebrow}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label={t.checkout.edit}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-[11.5px] tracking-soft text-foreground/80 hover:text-foreground active:scale-95 transition"
                  >
                    <Pencil className="h-[12px] w-[12px]" strokeWidth={1.7} />
                    {t.checkout.edit}
                  </button>
                </div>
                <p className="mt-3 text-[11px] tracking-luxury text-muted-foreground">
                  {lang === "en"
                    ? t.checkout.savedTitle.toUpperCase()
                    : t.checkout.savedTitle}
                </p>
                <p className="mt-1 font-serif text-[18px] text-foreground leading-snug">
                  {address.fullName}
                </p>
                <p className="mt-1 text-[13px] text-foreground/80 leading-relaxed">
                  {address.street}, {address.district}
                  <br />
                  {address.city} {address.postalCode}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground tracking-soft">
                  <span dir="ltr" className="font-medium tracking-[0.15em] text-gold-deep">
                    {address.shortCode}
                  </span>
                  <span dir="ltr" className="tabular-nums">
                    {t.checkout.buildingNumber}: {address.buildingNumber}
                  </span>
                  <span dir="ltr" className="tabular-nums">
                    {t.checkout.additionalNumber}: {address.additionalNumber}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-border/60 text-[12px] text-foreground/75 space-y-0.5">
                  <p dir="ltr" className="tabular-nums">{address.phone}</p>
                  <p dir="ltr" className="truncate">{address.email}</p>
                  {address.notes ? (
                    <p className="mt-1 text-muted-foreground italic">
                      “{address.notes}”
                    </p>
                  ) : null}
                </div>
              </section>
            )}

            {/* Contact */}
            {editing && (
            <section className="space-y-3">
              <h2 className="text-[11px] tracking-luxury text-gold-deep">
                {lang === "en"
                  ? t.checkout.sectionContact.toUpperCase()
                  : t.checkout.sectionContact}
              </h2>

              <div>
                <label className={labelClass}>{t.checkout.fullName}</label>
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  aria-invalid={!!errors.fullName}
                  className={fieldClass(!!errors.fullName) + " mt-1.5"}
                  {...form.register("fullName")}
                />
                {errors.fullName && (
                  <p className={errorClass}>{errors.fullName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t.checkout.phone}</label>
                  {(() => {
                    const reg = form.register("phone");
                    return (
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+966 5X XXX XXXX"
                        maxLength={16}
                        dir="ltr"
                        aria-invalid={!!errors.phone}
                        className={fieldClass(!!errors.phone) + " mt-1.5 tabular-nums"}
                        {...reg}
                        onChange={(e) => {
                          e.target.value = formatSaudiPhone(e.target.value);
                          void reg.onChange(e);
                        }}
                      />
                    );
                  })()}
                  {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>{t.checkout.email}</label>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    dir="ltr"
                    aria-invalid={!!errors.email}
                    className={fieldClass(!!errors.email) + " mt-1.5"}
                    {...form.register("email")}
                  />
                  {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                </div>
              </div>
            </section>
            )}

            {/* Saudi National Address */}
            {editing && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-[15px] w-[15px] text-gold-deep" strokeWidth={1.6} />
                <h2 className="text-[11px] tracking-luxury text-gold-deep">
                  {lang === "en"
                    ? t.checkout.sectionAddress.toUpperCase()
                    : t.checkout.sectionAddress}
                </h2>
              </div>

              <div>
                <label className={labelClass}>{t.checkout.nationalAddress}</label>
                {(() => {
                  const reg = form.register("shortCode");
                  return (
                    <input
                      type="text"
                      placeholder="RIYD2342"
                      maxLength={8}
                      dir="ltr"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={!!errors.shortCode}
                      className={
                        fieldClass(!!errors.shortCode) +
                        " mt-1.5 uppercase tracking-[0.2em] font-medium"
                      }
                      {...reg}
                      onChange={(e) => {
                        e.target.value = formatShortCode(e.target.value);
                        void reg.onChange(e);
                      }}
                    />
                  );
                })()}
                {errors.shortCode ? (
                  <p className={errorClass}>{errors.shortCode.message}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground tracking-soft">
                    {t.checkout.nationalAddressHelp}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t.checkout.buildingNumber}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1234"
                    maxLength={4}
                    dir="ltr"
                    aria-invalid={!!errors.buildingNumber}
                    className={fieldClass(!!errors.buildingNumber) + " mt-1.5 tabular-nums"}
                    {...form.register("buildingNumber")}
                  />
                  {errors.buildingNumber && (
                    <p className={errorClass}>{errors.buildingNumber.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>{t.checkout.additionalNumber}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="5678"
                    maxLength={4}
                    dir="ltr"
                    aria-invalid={!!errors.additionalNumber}
                    className={
                      fieldClass(!!errors.additionalNumber) + " mt-1.5 tabular-nums"
                    }
                    {...form.register("additionalNumber")}
                  />
                  {errors.additionalNumber && (
                    <p className={errorClass}>{errors.additionalNumber.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>{t.checkout.street}</label>
                <input
                  type="text"
                  autoComplete="address-line1"
                  maxLength={120}
                  aria-invalid={!!errors.street}
                  className={fieldClass(!!errors.street) + " mt-1.5"}
                  {...form.register("street")}
                />
                {errors.street && <p className={errorClass}>{errors.street.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t.checkout.district}</label>
                  <input
                    type="text"
                    autoComplete="address-line2"
                    maxLength={80}
                    aria-invalid={!!errors.district}
                    className={fieldClass(!!errors.district) + " mt-1.5"}
                    {...form.register("district")}
                  />
                  {errors.district && (
                    <p className={errorClass}>{errors.district.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>{t.checkout.city}</label>
                  <input
                    type="text"
                    autoComplete="address-level2"
                    placeholder={t.checkout.cityPlaceholder}
                    maxLength={60}
                    aria-invalid={!!errors.city}
                    className={fieldClass(!!errors.city) + " mt-1.5"}
                    {...form.register("city")}
                  />
                  {errors.city && <p className={errorClass}>{errors.city.message}</p>}
                </div>
              </div>

              <div>
                <label className={labelClass}>{t.checkout.postalCode}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="12345"
                  maxLength={5}
                  dir="ltr"
                  aria-invalid={!!errors.postalCode}
                  className={fieldClass(!!errors.postalCode) + " mt-1.5 tabular-nums"}
                  {...form.register("postalCode")}
                />
                {errors.postalCode && (
                  <p className={errorClass}>{errors.postalCode.message}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>{t.checkout.notes}</label>
                <textarea
                  rows={3}
                  maxLength={240}
                  placeholder={t.checkout.notesPlaceholder}
                  aria-invalid={!!errors.notes}
                  className={[
                    "w-full rounded-[16px] bg-cream-warm/40 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 tracking-soft outline-none transition border resize-none mt-1.5",
                    errors.notes
                      ? "border-destructive/60 focus:border-destructive"
                      : "border-border focus:border-gold",
                  ].join(" ")}
                  {...form.register("notes")}
                />
                {errors.notes && <p className={errorClass}>{errors.notes.message}</p>}
              </div>
            </section>
            )}

            {/* Order summary */}
            <section className="rounded-[20px] border border-border bg-background p-5 space-y-2">
              <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                <span>{t.bag.subtotal}</span>
                <span className="tabular-nums">
                  {fmt(bag.subtotal)} {bag.currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                <span>{t.bag.shipping}</span>
                <span className="text-gold-deep tracking-soft">{t.bag.shippingFree}</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] tracking-luxury text-muted-foreground">
                  {lang === "en" ? t.bag.estimatedTotal.toUpperCase() : t.bag.estimatedTotal}
                </span>
                <span className="font-serif text-[22px] text-foreground tabular-nums">
                  {fmt(total)} {bag.currency}
                </span>
              </div>
            </section>

            <div className="text-center">
              <Link to="/bag" className="text-[12px] tracking-luxury text-gold-deep">
                {lang === "en"
                  ? t.bag.continueShopping.toUpperCase()
                  : t.bag.continueShopping}
              </Link>
            </div>

            {/* Confirmation summary — shown above the CTA whenever a valid address is in scope. */}
            <section
              aria-live="polite"
              className={[
                "rounded-[20px] p-5 transition",
                confirmedAddress
                  ? "border border-gold bg-cream-warm/50 shadow-soft"
                  : "border border-dashed border-border bg-cream-warm/20",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={[
                    "h-[15px] w-[15px]",
                    confirmedAddress ? "text-gold-deep" : "text-muted-foreground",
                  ].join(" ")}
                  strokeWidth={1.7}
                />
                <span
                  className={[
                    "text-[10.5px] tracking-luxury",
                    confirmedAddress ? "text-gold-deep" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {lang === "en"
                    ? t.checkout.confirmEyebrow
                    : t.checkout.confirmEyebrow}
                </span>
              </div>

              {confirmedAddress ? (
                <>
                  <p className="mt-3 font-serif text-[17px] text-foreground leading-snug">
                    {confirmedAddress.fullName}
                  </p>
                  <p className="mt-1 text-[13px] text-foreground/85 leading-relaxed">
                    {confirmedAddress.street}, {confirmedAddress.district}
                    <br />
                    {confirmedAddress.city} {confirmedAddress.postalCode}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <div>
                      <dt className="text-[10px] tracking-luxury text-muted-foreground">
                        {t.checkout.nationalAddress}
                      </dt>
                      <dd
                        dir="ltr"
                        className="mt-0.5 font-medium tracking-[0.18em] text-gold-deep tabular-nums"
                      >
                        {confirmedAddress.shortCode}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] tracking-luxury text-muted-foreground">
                        {t.checkout.buildingNumber}
                      </dt>
                      <dd dir="ltr" className="mt-0.5 text-foreground/85 tabular-nums">
                        {confirmedAddress.buildingNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] tracking-luxury text-muted-foreground">
                        {t.checkout.additionalNumber}
                      </dt>
                      <dd dir="ltr" className="mt-0.5 text-foreground/85 tabular-nums">
                        {confirmedAddress.additionalNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] tracking-luxury text-muted-foreground">
                        {t.checkout.phone}
                      </dt>
                      <dd dir="ltr" className="mt-0.5 text-foreground/85 tabular-nums truncate">
                        {confirmedAddress.phone}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-2 text-[11.5px] text-muted-foreground tracking-soft truncate" dir="ltr">
                    {confirmedAddress.email}
                  </p>
                  {confirmedAddress.notes ? (
                    <p className="mt-2 text-[11.5px] text-muted-foreground italic">
                      “{confirmedAddress.notes}”
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground tracking-soft">
                  {t.checkout.confirmAwaiting}
                </p>
              )}
            </section>

            {/* Sticky CTA */}
            <div className="fixed sm:absolute bottom-0 inset-x-0 max-w-[440px] mx-auto bg-background/95 backdrop-blur-md border-t border-border">
              <div className="px-5 pt-4 pb-6">
                {editing ? (
                  <button
                    type="submit"
                    disabled={form.formState.isSubmitting || bagEmpty}
                    aria-disabled={bagEmpty || undefined}
                    className="w-full h-[58px] rounded-full bg-foreground text-background text-[14px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-soft disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <Lock className="h-[16px] w-[16px]" strokeWidth={1.7} />
                    {address ? t.checkout.useThisAddress : t.checkout.submit} · {fmt(total)} {bag.currency}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPlaceOrder}
                    disabled={bagEmpty}
                    aria-disabled={bagEmpty || undefined}
                    className="w-full h-[58px] rounded-full bg-foreground text-background text-[14px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-soft disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <Lock className="h-[16px] w-[16px]" strokeWidth={1.7} />
                    {t.checkout.submit} · {fmt(total)} {bag.currency}
                  </button>
                )}
                <p className="mt-2 text-center text-[10.5px] text-muted-foreground tracking-soft">
                  {t.bag.secure}
                </p>
              </div>
              <div className="mx-auto mb-2 h-[5px] w-[120px] rounded-full bg-foreground/80" />
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
