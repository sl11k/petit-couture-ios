import { createFileRoute, Link } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { Truck, Globe, Gift, Package, Clock, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export const Route = createFileRoute("/shipping")({
  head: () =>
    buildMeta({
      title: "الشحن والتوصيل | Shipping & Delivery",
      description: "تعرّف على خيارات الشحن داخل السعودية والشحن الدولي وشروط الشحن المجاني.",
      path: "/shipping",
    }),
  component: ShippingPage,
});

function ShippingPage() {
  const { lang, isRTL } = useLanguage();
  const ar = isRTL;

  const methods = [
    {
      icon: Truck,
      title_ar: "توصيل قياسي داخل السعودية",
      title_en: "Standard delivery (KSA)",
      eta_ar: "٣–٥ أيام عمل",
      eta_en: "3–5 business days",
      fee_ar: "٢٥ ر.س — مجاني للطلبات فوق ٥٠٠ ر.س",
      fee_en: "25 SAR — Free over 500 SAR",
    },
    {
      icon: Clock,
      title_ar: "توصيل سريع داخل السعودية",
      title_en: "Express delivery (KSA)",
      eta_ar: "خلال ٢٤ ساعة",
      eta_en: "Within 24 hours",
      fee_ar: "٤٥ ر.س",
      fee_en: "45 SAR",
    },
    {
      icon: Globe,
      title_ar: "شحن دولي (دول الخليج)",
      title_en: "International (GCC)",
      eta_ar: "٧–١٤ يوم عمل",
      eta_en: "7–14 business days",
      fee_ar: "تبدأ من ١٢٠ ر.س — حسب الوزن والوجهة",
      fee_en: "From 120 SAR — varies by weight & destination",
    },
    {
      icon: MapPin,
      title_ar: "استلام من الفرع",
      title_en: "Store pickup",
      eta_ar: "جاهز خلال ساعتين",
      eta_en: "Ready in 2 hours",
      fee_ar: "مجاني",
      fee_en: "Free",
    },
  ];

  return (
    <main className="max-w-3xl mx-auto px-5 py-10" dir={isRTL ? "rtl" : "ltr"}>
      <header className="mb-8">
        <h1 className="font-serif text-[32px] text-foreground">
          {ar ? "الشحن والتوصيل" : "Shipping & Delivery"}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {ar
            ? "نوفّر خيارات شحن متعددة داخل المملكة العربية السعودية وإلى دول الخليج العربي."
            : "We offer multiple shipping options within Saudi Arabia and across the GCC."}
        </p>
      </header>

      {/* Free shipping banner */}
      <section className="mb-8 rounded-[18px] border border-gold-deep/30 bg-gold-deep/5 p-5 flex items-start gap-3">
        <Gift className="h-6 w-6 text-gold-deep shrink-0 mt-0.5" />
        <div>
          <h2 className="font-serif text-[18px] text-foreground mb-1">
            {ar ? "شحن مجاني للطلبات فوق ٥٠٠ ر.س" : "Free shipping over 500 SAR"}
          </h2>
          <p className="text-[13px] text-foreground/80 leading-relaxed">
            {ar
              ? "احصل على شحن قياسي مجاني داخل المملكة العربية السعودية عند وصول قيمة طلبك إلى ٥٠٠ ر.س أو أكثر. لا حاجة لرمز ترويجي — يُطبّق الخصم تلقائياً عند الدفع."
              : "Enjoy free standard shipping within Saudi Arabia on orders of 500 SAR or more. No code needed — the discount is applied automatically at checkout."}
          </p>
        </div>
      </section>

      {/* Methods grid */}
      <section className="space-y-3 mb-10">
        <h2 className="font-serif text-[22px] text-foreground mb-3">
          {ar ? "خيارات الشحن" : "Shipping options"}
        </h2>
        {methods.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title_en} className="rounded-[14px] border border-border p-4 flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-cream-warm grid place-items-center shrink-0">
                <Icon className="h-5 w-5 text-gold-deep" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[15px] text-foreground">
                  {ar ? m.title_ar : m.title_en}
                </h3>
                <p className="text-[12.5px] text-muted-foreground mt-1">
                  {ar ? m.eta_ar : m.eta_en}
                </p>
              </div>
              <div className="text-end text-[13px] font-medium text-foreground whitespace-nowrap">
                {ar ? m.fee_ar : m.fee_en}
              </div>
            </div>
          );
        })}
      </section>

      {/* International shipping */}
      <section className="mb-10">
        <h2 className="font-serif text-[22px] text-foreground mb-3 flex items-center gap-2">
          <Globe className="h-5 w-5 text-gold-deep" />
          {ar ? "الشحن الدولي" : "International shipping"}
        </h2>
        <div className="rounded-[14px] border border-border p-5 space-y-3 text-[13.5px] text-foreground/85 leading-relaxed">
          <p>
            {ar
              ? "نشحن حالياً إلى دول مجلس التعاون الخليجي: الإمارات، الكويت، البحرين، عُمان، وقطر."
              : "We currently ship to all GCC countries: UAE, Kuwait, Bahrain, Oman, and Qatar."}
          </p>
          <ul className="space-y-2 ps-5 list-disc marker:text-gold-deep">
            <li>
              {ar
                ? "تبدأ أسعار الشحن الدولي من ١٢٠ ر.س وتختلف حسب الوزن والوجهة."
                : "International rates start at 120 SAR and vary based on weight and destination."}
            </li>
            <li>
              {ar
                ? "مدة التوصيل المتوقّعة ٧–١٤ يوم عمل بعد تأكيد الطلب."
                : "Estimated delivery: 7–14 business days after order confirmation."}
            </li>
            <li>
              {ar
                ? "قد تُطبّق رسوم جمركية وضرائب محلية يتحمّلها العميل عند الاستلام."
                : "Customs duties and local taxes may apply and are the customer's responsibility upon receipt."}
            </li>
            <li>
              {ar
                ? "للشحن خارج دول الخليج، يُرجى التواصل معنا قبل تقديم الطلب."
                : "For shipping outside the GCC, please contact us before placing your order."}
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <Link to="/" className="h-11 px-6 rounded-xl border border-border text-[13px] flex items-center">
          {ar ? "متابعة التسوّق" : "Continue shopping"}
        </Link>
        <Link to="/help" className="h-11 px-6 rounded-xl bg-foreground text-background text-[13px] flex items-center">
          {ar ? "الأسئلة الشائعة" : "FAQ"}
        </Link>
      </div>

      <p className="mt-8 text-[12px] text-muted-foreground text-center">
        <Package className="inline h-3.5 w-3.5 me-1" />
        {ar
          ? "للاستفسارات حول الشحن، تواصل معنا عبر صفحة الدعم."
          : "For shipping inquiries, contact us via our support page."}
      </p>
    </main>
  );
}
