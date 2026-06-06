import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { ChevronLeft, ChevronRight, Heart, LogOut, Mail, Lock, Package, MapPin, RotateCcw, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/state/AuthContext";
import { useWishlist } from "@/state/WishlistContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () =>
    buildMeta({
      title: "حسابي — Le Petit Paradis",
      description:
        "سجّل الدخول لمزامنة قائمة رغباتك وطلباتك عبر كل أجهزتك مع Le Petit Paradis.",
      path: "/account",
      noindex: true,
    }),
  component: AccountPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
});

type Mode = "signin" | "signup";

function AccountPage() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { user, ready, signIn, signUp, signOut } = useAuth();
  const wishlist = useWishlist();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === "password") setError(t.account.weakPassword);
      else setError(t.account.invalidCredentials);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(parsed.data.email, parsed.data.password);
      } else {
        await signUp(parsed.data.email, parsed.data.password);
      }
      setPassword("");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const message = raw.toLowerCase();
      if (message.includes("already") || message.includes("registered") || message.includes("user_already_exists")) {
        setError(t.account.emailInUse);
      } else if (message.includes("invalid") && message.includes("credentials")) {
        setError(t.account.invalidCredentials);
      } else if (message.includes("pwned") || message.includes("compromised") || message.includes("leaked")) {
        setError(isRTL ? "كلمة المرور هذه مسرّبة في خروقات بيانات سابقة، اختر كلمة مرور أخرى." : "This password has appeared in a data breach. Choose another one.");
      } else if (message.includes("weak") || message.includes("password should") || message.includes("at least")) {
        setError(isRTL ? "كلمة المرور ضعيفة، استخدم 8 أحرف على الأقل مع أرقام ورموز." : "Password too weak — use at least 8 characters with numbers/symbols.");
      } else if (message.includes("invalid") && message.includes("email")) {
        setError(isRTL ? "البريد الإلكتروني غير صالح." : "Invalid email address.");
      } else if (message.includes("rate") || message.includes("too many")) {
        setError(isRTL ? "محاولات كثيرة، حاول لاحقًا." : "Too many attempts, try again later.");
      } else {
        setError(raw || t.account.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center" dir={t.dir}>
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* Header */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            aria-label={isRTL ? "رجوع" : "Back"}
            onClick={() => router.history.back()}
            className="h-10 w-10 -ms-2 grid place-items-center rounded-xl text-foreground/80 active:scale-95 transition"
          >
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {t.account.eyebrow}
          </span>
          <span className="h-10 w-10" />
        </header>

        <main className="px-6 pb-16">
          {/* Hero */}
          <section className="pt-6 text-center">
            <div className="mx-auto h-[88px] w-[88px] rounded-full bg-cream-warm grid place-items-center border border-gold-soft">
              <Heart
                className="h-[28px] w-[28px] text-gold-deep"
                strokeWidth={1.4}
                fill={user ? "currentColor" : "none"}
              />
            </div>
            <h1 className="mt-6 font-serif text-[28px] leading-tight text-foreground">
              {user ? t.account.titleSignedIn : t.account.titleSignedOut}
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground tracking-soft max-w-[300px] mx-auto">
              {t.account.subtitle}
            </p>
          </section>

          {ready && user ? (
            <SignedIn
              email={user.email ?? ""}
              syncedCountLabel={t.account.syncedCount(wishlist.count)}
              welcome={t.account.welcome(user.email?.split("@")[0] ?? "")}
              signedInAs={t.account.signedInAs}
              signOutLabel={t.account.signOut}
              onSignOut={() => void signOut()}
            />
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-3">
              <Field
                id="account-email"
                type="email"
                value={email}
                onChange={setEmail}
                label={t.account.email}
                Icon={Mail}
                autoComplete="email"
                disabled={submitting}
              />
              <Field
                id="account-password"
                type="password"
                value={password}
                onChange={setPassword}
                label={t.account.password}
                Icon={Lock}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                disabled={submitting}
              />

              {error && (
                <p
                  role="alert"
                  className="text-[12px] text-destructive tracking-soft text-center pt-1"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-3 w-full h-[52px] rounded-xl bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft disabled:opacity-60"
              >
                {mode === "signin" ? t.account.signIn : t.account.signUp}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === "signin" ? "signup" : "signin"));
                  setError(null);
                }}
                className="block mx-auto mt-2 text-[11.5px] tracking-luxury text-gold-deep py-2"
              >
                {mode === "signin"
                  ? isRTL
                    ? t.account.switchToSignUp
                    : t.account.switchToSignUp.toUpperCase()
                  : isRTL
                    ? t.account.switchToSignIn
                    : t.account.switchToSignIn.toUpperCase()}
              </button>
            </form>
          )}

          <div className="mt-10 text-center">
            <Link to="/" className="text-[12px] tracking-luxury text-gold-deep">
              {isRTL ? t.bag.continueShopping : t.bag.continueShopping.toUpperCase()}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({
  id,
  type,
  value,
  onChange,
  label,
  Icon,
  autoComplete,
  disabled,
}: {
  id: string;
  type: "email" | "password";
  value: string;
  onChange: (v: string) => void;
  label: string;
  Icon: typeof Mail;
  autoComplete: string;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="sr-only">{label}</span>
      <div className="relative">
        <Icon
          className="absolute start-4 top-1/2 -translate-y-1/2 h-[16px] w-[16px] text-muted-foreground"
          strokeWidth={1.5}
        />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className="w-full h-[52px] ps-12 pe-4 rounded-xl bg-cream-warm/60 border border-border text-[14px] text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-gold-soft focus:bg-background transition"
        />
      </div>
    </label>
  );
}

function SignedIn({
  email,
  syncedCountLabel,
  welcome,
  signedInAs,
  signOutLabel,
  onSignOut,
}: {
  email: string;
  syncedCountLabel: string;
  welcome: string;
  signedInAs: string;
  signOutLabel: string;
  onSignOut: () => void;
}) {
  const { isRTL } = useLanguage();
  const [tab, setTab] = useState<"overview" | "orders" | "addresses" | "returns">("overview");

  const tabs: { key: typeof tab; ar: string; en: string; Icon: typeof Package }[] = [
    { key: "orders", ar: "طلباتي", en: "Orders", Icon: Package },
    { key: "addresses", ar: "عناويني", en: "Addresses", Icon: MapPin },
    { key: "returns", ar: "إرجاعاتي", en: "Returns", Icon: RotateCcw },
  ];

  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-[22px] border border-border bg-cream-warm/40 p-5 text-center">
        <p className="text-[10.5px] tracking-luxury text-gold-deep">{signedInAs}</p>
        <p className="mt-2 font-serif text-[20px] text-foreground break-all">{email}</p>
        <p className="mt-3 text-[12px] text-muted-foreground tracking-soft">
          {welcome} · {syncedCountLabel}
        </p>
      </div>

      {/* Tab strip */}
      <div className="grid grid-cols-3 gap-2">
        {tabs.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(active ? "overview" : tb.key)}
              className={[
                "h-[68px] rounded-[18px] border flex flex-col items-center justify-center gap-1 text-[11px] tracking-soft transition active:scale-[0.97]",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-cream-warm/40 text-foreground border-border",
              ].join(" ")}
            >
              <tb.Icon className="h-[16px] w-[16px]" strokeWidth={1.6} />
              <span>{isRTL ? tb.ar : tb.en}</span>
            </button>
          );
        })}
      </div>

      {tab === "orders" && <OrdersPanel />}
      {tab === "addresses" && <AddressesPanel />}
      {tab === "returns" && <ReturnsPanel />}

      <Link
        to="/wishlist"
        className="w-full h-[52px] rounded-xl bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft"
      >
        {isRTL ? "قائمة الرغبات" : "View wishlist"}
      </Link>

      <button
        type="button"
        onClick={onSignOut}
        className="w-full h-[52px] rounded-xl border border-border text-foreground text-[12px] tracking-luxury active:scale-[0.97] transition inline-flex items-center justify-center gap-2"
      >
        <LogOut className="h-[14px] w-[14px]" strokeWidth={1.6} />
        {signOutLabel}
      </button>
    </section>
  );
}

// ============= Orders Panel =============
type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  created_at: string;
};

function OrdersPanel() {
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total, currency, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error(error);
        setRows([]);
        return;
      }
      setRows((data as OrderRow[]) ?? []);
    })();
  }, []);

  if (rows === null) {
    return <p className="text-center text-[12px] text-muted-foreground py-6">{isRTL ? "جاري التحميل…" : "Loading…"}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-[18px] border border-border bg-cream-warm/30 p-6 text-center">
        <Package className="h-[28px] w-[28px] text-muted-foreground mx-auto" strokeWidth={1.4} />
        <p className="mt-3 text-[13px] text-foreground tracking-soft">{isRTL ? "لا توجد طلبات بعد" : "No orders yet"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((o) => (
        <Link
          key={o.id}
          to="/order-confirmation/$orderNumber"
          params={{ orderNumber: o.order_number }}
          className="block rounded-[18px] border border-border bg-cream-warm/30 px-4 py-3 active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[12px] text-foreground">{o.order_number}</span>
            <span className="text-[11px] tracking-luxury text-gold-deep uppercase">{o.status}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>{new Date(o.created_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US")}</span>
            <span className="text-foreground font-medium">{Number(o.total).toFixed(2)} {o.currency}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ============= Addresses Panel =============
type AddressRow = {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  city: string;
  district: string | null;
  street: string | null;
  postal_code: string | null;
  is_default: boolean;
};

function AddressesPanel() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState<AddressRow[] | null>(null);
  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("customer_addresses")
      .select("id, label, full_name, phone, city, district, street, postal_code, is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error(error); setRows([]); return; }
    setRows((data as AddressRow[]) ?? []);
  };
  useEffect(() => { void load(); }, []);

  const del = async (id: string) => {
    const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم الحذف" : "Deleted");
    void load();
  };

  const makeDefault = async (id: string) => {
    const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  if (rows === null) {
    return <p className="text-center text-[12px] text-muted-foreground py-6">{isRTL ? "جاري التحميل…" : "Loading…"}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <div key={a.id} className="rounded-[18px] border border-border bg-cream-warm/30 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">{a.label || a.full_name}</span>
                {a.is_default && (
                  <span className="text-[9.5px] tracking-luxury text-gold-deep border border-gold-soft px-2 py-0.5 rounded-full">
                    {isRTL ? "افتراضي" : "DEFAULT"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">{a.full_name} · {a.phone}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                {[a.street, a.district, a.city, a.postal_code].filter(Boolean).join("، ")}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              {!a.is_default && (
                <button onClick={() => void makeDefault(a.id)} title={isRTL ? "اجعله افتراضي" : "Set default"} className="h-8 w-8 grid place-items-center rounded-xl border border-border active:scale-95">
                  <Check className="h-[14px] w-[14px]" strokeWidth={1.6} />
                </button>
              )}
              <button onClick={() => { setEditing(a); setShowForm(true); }} className="h-8 w-8 grid place-items-center rounded-xl border border-border active:scale-95">
                <Pencil className="h-[13px] w-[13px]" strokeWidth={1.6} />
              </button>
              <button onClick={() => void del(a.id)} className="h-8 w-8 grid place-items-center rounded-xl border border-border text-destructive active:scale-95">
                <Trash2 className="h-[13px] w-[13px]" strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {rows.length === 0 && !showForm && (
        <div className="rounded-[18px] border border-border bg-cream-warm/30 p-6 text-center">
          <MapPin className="h-[28px] w-[28px] text-muted-foreground mx-auto" strokeWidth={1.4} />
          <p className="mt-3 text-[13px] text-foreground tracking-soft">{isRTL ? "لا توجد عناوين محفوظة" : "No saved addresses"}</p>
        </div>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-full h-[48px] rounded-xl border border-dashed border-gold-soft text-gold-deep text-[12px] tracking-luxury inline-flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Plus className="h-[14px] w-[14px]" strokeWidth={1.6} />
          {isRTL ? "إضافة عنوان" : "Add address"}
        </button>
      ) : (
        <AddressForm
          userId={user?.id ?? ""}
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function AddressForm({
  userId,
  initial,
  onCancel,
  onSaved,
}: {
  userId: string;
  initial: AddressRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { isRTL } = useLanguage();
  const [form, setForm] = useState({
    label: initial?.label ?? "",
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    city: initial?.city ?? "",
    district: initial?.district ?? "",
    street: initial?.street ?? "",
    postal_code: initial?.postal_code ?? "",
    is_default: initial?.is_default ?? false,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim()) {
      toast.error(isRTL ? "أكمل الحقول المطلوبة" : "Complete required fields");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        const { error } = await supabase.from("customer_addresses").update(form).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_addresses").insert({ ...form, user_id: userId });
        if (error) throw error;
      }
      toast.success(isRTL ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full h-[44px] rounded-[14px] bg-cream-warm/40 border border-border px-3 text-[13px] focus:outline-none focus:border-gold-soft";

  return (
    <form onSubmit={submit} className="rounded-[18px] border border-border bg-background p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium">{initial ? (isRTL ? "تعديل العنوان" : "Edit address") : (isRTL ? "عنوان جديد" : "New address")}</h3>
        <button type="button" onClick={onCancel} className="h-8 w-8 grid place-items-center rounded-xl border border-border">
          <X className="h-[14px] w-[14px]" strokeWidth={1.6} />
        </button>
      </div>
      <input className={input} placeholder={isRTL ? "تسمية (مثل: المنزل)" : "Label (e.g. Home)"} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      <input className={input} placeholder={isRTL ? "الاسم الكامل *" : "Full name *"} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
      <input className={input} placeholder={isRTL ? "الهاتف *" : "Phone *"} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
      <input className={input} placeholder={isRTL ? "المدينة *" : "City *"} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
      <input className={input} placeholder={isRTL ? "الحي" : "District"} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
      <input className={input} placeholder={isRTL ? "الشارع" : "Street"} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
      <input className={input} placeholder={isRTL ? "الرمز البريدي" : "Postal code"} value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
      <label className="flex items-center gap-2 text-[12px] text-muted-foreground pt-1">
        <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-foreground" />
        {isRTL ? "اجعله العنوان الافتراضي" : "Set as default"}
      </label>
      <button type="submit" disabled={saving} className="mt-2 w-full h-[44px] rounded-xl bg-foreground text-background text-[12px] tracking-luxury disabled:opacity-60 active:scale-[0.97]">
        {saving ? (isRTL ? "جاري الحفظ…" : "Saving…") : (isRTL ? "حفظ" : "Save")}
      </button>
    </form>
  );
}

// ============= Returns Panel =============
type ReturnRow = {
  id: string;
  return_number: string;
  order_number: string | null;
  status: string;
  reason: string;
  refund_amount: number | null;
  created_at: string;
};

function ReturnsPanel() {
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<ReturnRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("return_requests")
        .select("id, return_number, order_number, status, reason, refund_amount, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) { console.error(error); setRows([]); return; }
      setRows((data as ReturnRow[]) ?? []);
    })();
  }, []);

  if (rows === null) {
    return <p className="text-center text-[12px] text-muted-foreground py-6">{isRTL ? "جاري التحميل…" : "Loading…"}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-[18px] border border-border bg-cream-warm/30 p-6 text-center">
        <RotateCcw className="h-[28px] w-[28px] text-muted-foreground mx-auto" strokeWidth={1.4} />
        <p className="mt-3 text-[13px] text-foreground tracking-soft">{isRTL ? "لا توجد طلبات إرجاع" : "No return requests"}</p>
        <Link to="/account/returns/new" search={{ order: "" }} className="mt-3 inline-block text-[11px] tracking-luxury text-gold-deep">
          {isRTL ? "طلب إرجاع جديد" : "REQUEST A RETURN"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-[18px] border border-border bg-cream-warm/30 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[12px] text-foreground">{r.return_number}</span>
            <span className="text-[11px] tracking-luxury text-gold-deep uppercase">{r.status}</span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {isRTL ? "الطلب:" : "Order:"} {r.order_number ?? "—"}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{r.reason}</p>
          {r.refund_amount != null && Number(r.refund_amount) > 0 && (
            <p className="mt-1 text-[12px] text-foreground font-medium">
              {isRTL ? "المسترد:" : "Refund:"} {Number(r.refund_amount).toFixed(2)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
