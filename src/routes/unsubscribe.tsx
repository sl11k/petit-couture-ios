import { createFileRoute, useSearch } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export const Route = createFileRoute("/unsubscribe")({
  head: () =>
    buildMeta({
      title: "إلغاء الاشتراك — Le Petit Paradis",
      description: "إلغاء اشتراكك من رسائل Le Petit Paradis الترويجية.",
      path: "/unsubscribe",
      noindex: true,
    }),
  component: Unsubscribe,
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
});

function Unsubscribe() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const { t, isRTL, lang } = useLanguage();
  const ar = lang === "ar";
  const [status, setStatus] = useState<"loading" | "ok" | "invalid" | "already" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [channel, setChannel] = useState<string>("email");

  useEffect(() => {
    void (async () => {
      if (!token) { setStatus("invalid"); return; }
      const { data, error } = await db.from("unsubscribe_tokens").select("*").eq("token", token).maybeSingle();
      if (error || !data) { setStatus("invalid"); return; }
      if (data.used_at) { setEmail(data.email); setChannel(data.channel); setStatus("already"); return; }
      setEmail(data.email); setChannel(data.channel);
      await db.from("unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);
      if (data.user_id) {
        const col = `marketing_${data.channel}`;
        await db.from("customer_consents").upsert({
          user_id: data.user_id, [col]: false, source: "unsubscribe_link", updated_at: new Date().toISOString(),
        });
      }
      setStatus("ok");
    })();
  }, [token]);

  const channelLabel = (() => {
    if (channel === "email") return ar ? "البريد التسويقية" : "marketing email";
    if (channel === "sms") return ar ? "SMS التسويقية" : "marketing SMS";
    return channel;
  })();

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      {status === "loading" && <p className="text-sm text-muted-foreground">{t.legal.unsubscribeProcessing}</p>}
      {(status === "ok" || status === "already") && (
        <>
          <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" />
          <h1 className="mb-2 text-2xl font-bold">{status === "already" ? t.legal.unsubscribeAlready : t.legal.unsubscribeDone}</h1>
          <p className="text-sm text-muted-foreground">
            {ar ? `لن تصلك المزيد من رسائل ${channelLabel}` : `You will no longer receive ${channelLabel} messages`} {email && <>{ar ? "على" : "at"} <b>{email}</b></>}.
          </p>
          <a href="/account/privacy" className="mt-4 text-sm text-primary underline">{t.legal.managePrefs}</a>
        </>
      )}
      {status === "invalid" && (
        <>
          <XCircle className="mb-4 h-14 w-14 text-rose-500" />
          <h1 className="mb-2 text-2xl font-bold">{t.legal.unsubscribeInvalid}</h1>
          <p className="text-sm text-muted-foreground">{t.legal.unsubscribeInvalidBody}</p>
        </>
      )}
    </main>
  );
}
