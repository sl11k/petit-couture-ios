import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/state/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

export const Route = createFileRoute("/login")({
  head: () =>
    buildMeta({
      title: "تسجيل الدخول — Maisonnét",
      description:
        "سجّل الدخول إلى حسابك في Maisonnét لمتابعة طلباتك وقائمة رغباتك.",
      path: "/login",
      noindex: true,
    }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { lang, t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const ar = lang === "ar";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      navigate({ to: "/account" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (ar ? "فشل المصادقة" : "Authentication failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          {mode === "signin" ? t.account.signIn : t.account.signUp}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">{t.account.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">{t.account.password}</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "..." : mode === "signin" ? t.account.signIn : t.account.signUp}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? t.account.switchToSignUp : t.account.switchToSignIn}
        </button>
        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground">
          {t.common.backToStore}
        </Link>
      </div>
    </div>
  );
}
