import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/forgot-password")({
  head: () =>
    buildMeta({
      title: "استعادة كلمة المرور — Le Petit Paradis",
      description: "أعد تعيين كلمة المرور لحسابك في Le Petit Paradis.",
      path: "/forgot-password",
      noindex: true,
    }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { isRTL } = useLanguage();
  const ar = isRTL;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذّر إرسال البريد"
            : "Failed to send email",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          {ar ? "نسيت كلمة المرور؟" : "Forgot password?"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {ar
            ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {sent ? (
          <div className="rounded-md bg-muted/40 p-4 text-sm text-foreground">
            {ar
              ? "تم إرسال رابط إعادة التعيين إلى بريدك إن كان مسجلاً لدينا."
              : "If an account exists, a reset link has been sent to your email."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {ar ? "البريد الإلكتروني" : "Email"}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading
                ? "..."
                : ar
                  ? "إرسال رابط الاستعادة"
                  : "Send reset link"}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {ar ? "العودة إلى تسجيل الدخول" : "Back to sign in"}
        </Link>
      </div>
    </div>
  );
}
