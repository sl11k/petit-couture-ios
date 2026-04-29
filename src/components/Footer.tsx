import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchStorefrontSettings, type StorefrontSettings } from "@/lib/storefront";
import { BrandLogo, BRAND_NAME } from "@/components/Logo";

export function Footer() {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);

  useEffect(() => {
    fetchStorefrontSettings().then(setSettings).catch(() => {/* noop */});
  }, []);

  const about = ar
    ? (settings?.footer_about_ar ?? "أزياء أطفال فاخرة مختارة بعناية للحظات الراقية والاحتفالات الخاصة.")
    : (settings?.footer_about_en ?? "Curated luxury kids' fashion for refined moments and special celebrations.");
  const address = ar
    ? (settings?.footer_address_ar ?? "الرياض، المملكة العربية السعودية")
    : (settings?.footer_address_en ?? "Riyadh, Kingdom of Saudi Arabia");
  const phone = settings?.footer_phone ?? "+966 50 000 0000";
  const email = settings?.footer_email ?? "hello@lepetitparadis.com";
  const ig = settings?.footer_instagram ?? "https://instagram.com";
  const tiktok = settings?.footer_tiktok ?? "https://tiktok.com";
  const wa = settings?.footer_whatsapp ?? "https://wa.me/966500000000";

  return (
    <footer className="bg-foreground text-background mt-12" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <div className="bg-background rounded-md inline-flex p-2">
              <BrandLogo height={28} />
            </div>
            <p className="text-[13px] leading-relaxed text-background/75">{about}</p>
          </div>

          <div>
            <h3 className="text-[11px] tracking-[0.2em] text-background/60 mb-4">
              {ar ? "تسوّق" : "Shop"}
            </h3>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/category/$slug" params={{ slug: "new-in" }} className="hover:text-gold transition">{ar ? "وصل حديثًا" : "New In"}</Link></li>
              <li><Link to="/category/$slug" params={{ slug: "best-sellers" }} className="hover:text-gold transition">{ar ? "الأكثر مبيعاً" : "Best Sellers"}</Link></li>
              <li><Link to="/category/$slug" params={{ slug: "dresses" }} className="hover:text-gold transition">{ar ? "فساتين" : "Dresses"}</Link></li>
              <li><Link to="/category/$slug" params={{ slug: "shoes" }} className="hover:text-gold transition">{ar ? "أحذية" : "Shoes"}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] tracking-[0.2em] text-background/60 mb-4">
              {ar ? "خدمة العملاء" : "Customer Care"}
            </h3>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/help" className="hover:text-gold transition">{ar ? "الأسئلة الشائعة" : "FAQ"}</Link></li>
              <li><Link to="/contact" className="hover:text-gold transition">{ar ? "تواصل معنا" : "Contact us"}</Link></li>
              <li><Link to="/track-order" className="hover:text-gold transition">{ar ? "تتبع الطلب" : "Track order"}</Link></li>
              <li><Link to="/privacy" className="hover:text-gold transition">{ar ? "الخصوصية" : "Privacy"}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[11px] tracking-[0.2em] text-background/60 mb-4">
              {ar ? "تواصل" : "Get in touch"}
            </h3>
            <ul className="space-y-2.5 text-[13px]">
              <li className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-1 shrink-0 text-gold" /><span>{address}</span></li>
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-gold" /><a href={`tel:${phone}`} dir="ltr" className="hover:text-gold">{phone}</a></li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-gold" /><a href={`mailto:${email}`} className="hover:text-gold">{email}</a></li>
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <a href={ig} target="_blank" rel="noopener" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full border border-background/20 hover:bg-background/10 transition"><Instagram className="h-4 w-4" /></a>
              <a href={wa} target="_blank" rel="noopener" aria-label="WhatsApp" className="grid h-9 w-9 place-items-center rounded-full border border-background/20 hover:bg-background/10 transition"><MessageCircle className="h-4 w-4" /></a>
              <a href={tiktok} target="_blank" rel="noopener" aria-label="TikTok" className="grid h-9 w-9 place-items-center rounded-full border border-background/20 hover:bg-background/10 transition">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M19.32 6.69a4.83 4.83 0 0 1-3.78-1.85V15.4a5.6 5.6 0 1 1-5.6-5.6c.31 0 .6.03.9.08v2.94a2.74 2.74 0 1 0 1.97 2.63V2h2.74a4.84 4.84 0 0 0 3.77 4.69z"/></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-background/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-background/55 tracking-soft">
          <span>© {new Date().getFullYear()} {BRAND_NAME}. {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}</span>
          <span>{ar ? "صُنع بحب في المملكة العربية السعودية" : "Made with love in Saudi Arabia"}</span>
        </div>
      </div>
    </footer>
  );
}
