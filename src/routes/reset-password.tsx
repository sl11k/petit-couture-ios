import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  head: () =>
    buildMeta({
      title: "تعيين كلمة مرور جديدة — Le Petit Paradis",
      description: "اختر كلمة مرور جديدة لحسابك.",
      path: "/reset-password",
      noindex: true,
    }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { isRTL } = useLanguage();
  const ar = isRTL;
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the recovery hash and emits PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    // Also check if user is already in a recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecovery(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(ar ? "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" : "Password too short (min 6)");
      return;
    }
    if (password !== confirm) {
      setError(ar ? "كلمتا المرور غير متطابقتين" : "Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => void navigate({ to: "/account" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : ar ? "فشل التحديث" : "Update failed");
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
        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          {ar ? "كلمة مرور جديدة" : "New password"}
        </h1>

        {!ready ? (
          <p className="text-sm text-muted-foreground">...</p>
        ) : !recovery ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {ar
                ? "الرابط غير صالح أو منتهي. اطلب رابطاً جديداً."
                : "Invalid or expired link. Request a new one."}
            </p>
            <Link
              to="/forgot-password"
              className="block w-full rounded-md bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground"
            >
              {ar ? "طلب رابط جديد" : "Request new link"}
            </Link>
          </div>
        ) : done ? (
          <p className="text-sm text-foreground">
            {ar ? "تم تحديث كلمة المرور. سيتم تحويلك…" : "Password updated. Redirecting…"}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {ar ? "كلمة المرور الجديدة" : "New password"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {ar ? "تأكيد كلمة المرور" : "Confirm password"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "..." : ar ? "حفظ كلمة المرور" : "Save password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
