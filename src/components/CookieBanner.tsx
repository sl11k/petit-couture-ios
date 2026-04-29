import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { getStoredCookieConsent, saveCookieConsent, type CookieConsent } from "@/lib/privacy";
import { useAuth } from "@/state/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

export function CookieBanner() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [show, setShow] = useState(false);
  const [expand, setExpand] = useState(false);
  const [c, setC] = useState<CookieConsent>({ necessary: true, analytics: false, marketing: false, preferences: false });

  useEffect(() => {
    if (!getStoredCookieConsent()) setShow(true);
  }, []);

  async function accept(choice: CookieConsent) {
    await saveCookieConsent(choice, user?.id ?? null);
    setShow(false);
  }

  if (!show) return null;

  const T = {
    title: ar ? "نستخدم ملفات تعريف الارتباط (Cookies)" : "We use cookies",
    body: ar
      ? "نستخدم الكوكيز الضرورية لتشغيل الموقع، وكوكيز اختيارية لتحليل الأداء وتحسين تجربتك. يمكنك القبول الكامل أو الاكتفاء بالضرورية فقط، أو التخصيص."
      : "We use necessary cookies to run the site and optional cookies to analyze performance and improve your experience. You can accept all, keep only the necessary ones, or customize.",
    seePolicy: ar ? "راجع" : "See",
    privacy: ar ? "سياسة الخصوصية" : "Privacy Policy",
    close: ar ? "إغلاق" : "Close",
    necessary: ar ? "ضرورية (لا يمكن إيقافها)" : "Necessary (always on)",
    necessaryDesc: ar ? "جلسة الدخول، السلة، الأمان" : "Login session, cart, security",
    analytics: ar ? "تحليلية" : "Analytics",
    analyticsDesc: ar ? "قياس الأداء والاستخدام لتحسين الموقع" : "Measure performance and usage to improve the site",
    marketing: ar ? "تسويقية" : "Marketing",
    marketingDesc: ar ? "عرض إعلانات وعروض ذات صلة" : "Show relevant ads and offers",
    prefs: ar ? "تفضيلات" : "Preferences",
    prefsDesc: ar ? "حفظ اللغة والإعدادات" : "Save language and settings",
    acceptAll: ar ? "قبول الكل" : "Accept all",
    onlyNecessary: ar ? "الضرورية فقط" : "Necessary only",
    save: ar ? "حفظ تخصيصي" : "Save my choices",
    customize: ar ? "تخصيص" : "Customize",
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-3xl p-3 sm:p-4">
      <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><Cookie className="h-5 w-5 text-primary" /></div>
          <div className="flex-1 text-xs sm:text-sm">
            <h3 className="mb-1 font-semibold">{T.title}</h3>
            <p className="text-muted-foreground">
              {T.body}{" "}
              {T.seePolicy} <a href="/privacy" className="text-primary underline">{T.privacy}</a>.
            </p>
          </div>
          <button onClick={() => accept({ necessary: true, analytics: false, marketing: false, preferences: false })}
            className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={T.close}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {expand && (
          <div className="mb-3 space-y-2 rounded-lg border border-border bg-background/50 p-3">
            <Toggle label={T.necessary} desc={T.necessaryDesc} v={true} disabled />
            <Toggle label={T.analytics} desc={T.analyticsDesc}
              v={c.analytics} on={(v) => setC({ ...c, analytics: v })} />
            <Toggle label={T.marketing} desc={T.marketingDesc}
              v={c.marketing} on={(v) => setC({ ...c, marketing: v })} />
            <Toggle label={T.prefs} desc={T.prefsDesc}
              v={c.preferences} on={(v) => setC({ ...c, preferences: v })} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => accept({ necessary: true, analytics: true, marketing: true, preferences: true })}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 sm:flex-none">
            {T.acceptAll}
          </button>
          <button onClick={() => accept({ necessary: true, analytics: false, marketing: false, preferences: false })}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted sm:flex-none">
            {T.onlyNecessary}
          </button>
          {expand ? (
            <button onClick={() => accept(c)} className="flex-1 rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 sm:flex-none">
              {T.save}
            </button>
          ) : (
            <button onClick={() => setExpand(true)} className="flex-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted sm:flex-none">
              {T.customize}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, v, on, disabled }: { label: string; desc: string; v: boolean; on?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-3 ${disabled ? "opacity-70" : "cursor-pointer"}`}>
      <div className="text-xs">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{desc}</p>
      </div>
      <input type="checkbox" checked={v} onChange={(e) => on?.(e.target.checked)} disabled={disabled} className="mt-1 h-4 w-4" />
    </label>
  );
}
