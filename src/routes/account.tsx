import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { ChevronLeft, ChevronRight, Heart, LogOut, Mail, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/state/AuthContext";
import { useWishlist } from "@/state/WishlistContext";

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
            className="h-10 w-10 -ms-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition"
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
                className="mt-3 w-full h-[52px] rounded-full bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft disabled:opacity-60"
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
          className="w-full h-[52px] ps-12 pe-4 rounded-full bg-cream-warm/60 border border-border text-[14px] text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-gold-soft focus:bg-background transition"
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
  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-[22px] border border-border bg-cream-warm/40 p-5 text-center">
        <p className="text-[10.5px] tracking-luxury text-gold-deep">{signedInAs}</p>
        <p className="mt-2 font-serif text-[20px] text-foreground break-all">
          {email}
        </p>
        <p className="mt-3 text-[12px] text-muted-foreground tracking-soft">
          {welcome} · {syncedCountLabel}
        </p>
      </div>

      <Link
        to="/wishlist"
        className="w-full h-[52px] rounded-full bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft"
      >
        View wishlist
      </Link>

      <button
        type="button"
        onClick={onSignOut}
        className="w-full h-[52px] rounded-full border border-border text-foreground text-[12px] tracking-luxury active:scale-[0.97] transition inline-flex items-center justify-center gap-2"
      >
        <LogOut className="h-[14px] w-[14px]" strokeWidth={1.6} />
        {signOutLabel}
      </button>
    </section>
  );
}
