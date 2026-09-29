import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { getStoredCookieConsent, saveCookieConsent } from "@/lib/privacy";
import { useAuth } from "@/state/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

const ALL = { necessary: true, analytics: true, marketing: true, preferences: true };

/** Cookies are required to use the site: a notice with a single "OK" button. */
export function CookieBanner() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [show, setShow] = useState(false);

  useEffect(() => {
    const c = getStoredCookieConsent();
    if (!c || !c.marketing || !c.analytics) setShow(true);
  }, []);

  async function accept() {
    setShow(false);
    await saveCookieConsent(ALL, user?.id ?? null);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-3xl p-3 sm:p-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
        <div className="flex flex-1 items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Cookie className="h-5 w-5 text-primary" /></div>
          <p className="flex-1 text-xs text-muted-foreground sm:text-sm">
            {ar
              ? "يستخدم موقعنا ملفات تعريف الارتباط (الكوكيز) لتشغيل الموقع وتحسين تجربتك وعرض العروض المناسبة لك. باستمرارك في استخدام الموقع فإنك توافق على ذلك."
              : "Our site uses cookies to operate, improve your experience and show relevant offers. By continuing to use the site you agree to this."}{" "}
            <a href="/privacy" className="text-primary underline">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</a>
          </p>
        </div>
        <button onClick={accept}
          className="rounded-lg bg-primary px-6 py-2 text-xs font-medium text-primary-foreground hover:opacity-90">
          {ar ? "موافق" : "OK"}
        </button>
      </div>
    </div>
  );
}
