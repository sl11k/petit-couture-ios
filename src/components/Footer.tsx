import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchStorefrontSettings, type StorefrontSettings } from "@/lib/storefront";
import { BrandLogo, BRAND_NAME } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useDbCategories } from "@/hooks/useDbCategories";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/contactInfo";

type ContentPageLink = { slug: string; title_ar: string; title_en: string };

export function Footer() {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [pages, setPages] = useState<ContentPageLink[]>([]);
  const dbCats = useDbCategories();

  useEffect(() => {
    fetchStorefrontSettings(true)
      .then(setSettings)
      .catch(() => {
        /* noop */
      });
    (async () => {
      try {
        const { data } = await supabase
          .from("content_pages")
          .select("slug,title_ar,title_en")
          .eq("is_published", true)
          .order("sort_order", { ascending: true });
        setPages((data as ContentPageLink[]) ?? []);
      } catch {
        /* noop */
      }
    })();
  }, []);

  const about = ar
    ? (settings?.footer_about_ar ??
      "أزياء أطفال فاخرة مختارة بعناية للحظات الراقية والاحتفالات الخاصة.")
    : (settings?.footer_about_en ??
      "Curated luxury kids' fashion for refined moments and special celebrations.");
  const address = ar
    ? (settings?.footer_address_ar ?? "الرياض، المملكة العربية السعودية")
    : (settings?.footer_address_en ?? "Riyadh, Kingdom of Saudi Arabia");
  const email = settings?.footer_email;
  const ig = settings?.footer_instagram;
  const tiktok = settings?.footer_tiktok;
  const whatsappUrl = settings?.footer_whatsapp
    ? settings.footer_whatsapp.trim().startsWith("http")
      ? settings.footer_whatsapp.trim()
      : `https://wa.me/${settings.footer_whatsapp.replace(/\D/g, "")}`
    : undefined;

  return (
    <footer
      data-live-id="site-footer"
      className="bg-foreground text-background mt-12"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <div className="bg-background rounded-md inline-flex p-2">
              <BrandLogo height={28} />
            </div>
            <p
              data-live-id="footer-about"
              className="text-[13px] leading-relaxed text-background/75"
            >
              {about}
            </p>
          </div>

          <div>
            <h3
              data-live-id="footer-shop-title"
              className="text-[11px] tracking-[0.2em] text-background/60 mb-4"
            >
              {ar ? "تسوّق" : "Shop"}
            </h3>
            <ul className="space-y-2 text-[13px]">
              {dbCats.length > 0 &&
                dbCats.slice(0, 8).map((c) => (
                  <li key={c.slug}>
                    <Link
                      data-live-id={`footer-category-${c.slug}`}
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      className="hover:text-gold transition"
                    >
                      {ar ? c.name_ar : c.name_en}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3
              data-live-id="footer-care-title"
              className="text-[11px] tracking-[0.2em] text-background/60 mb-4"
            >
              {ar ? "خدمة العملاء" : "Customer Care"}
            </h3>
            <ul className="space-y-2 text-[13px]">
              <li data-live-id="footer-static-our-story">
                <Link to="/our-story" className="hover:text-gold transition">
                  {ar ? "قصتنا" : "Our Story"}
                </Link>
              </li>
              <li data-live-id="footer-static-help">
                <Link to="/help" className="hover:text-gold transition">
                  {ar ? "الأسئلة الشائعة" : "FAQ"}
                </Link>
              </li>
              <li data-live-id="footer-static-contact">
                <Link to="/contact" className="hover:text-gold transition">
                  {ar ? "تواصل معنا" : "Contact us"}
                </Link>
              </li>
              <li data-live-id="footer-static-track-order">
                <Link to="/track-order" className="hover:text-gold transition">
                  {ar ? "تتبع الطلب" : "Track order"}
                </Link>
              </li>
              <li data-live-id="footer-static-shipping">
                <Link to="/shipping" className="hover:text-gold transition">
                  {ar ? "الشحن والتوصيل" : "Shipping & Delivery"}
                </Link>
              </li>
              <li data-live-id="footer-static-privacy">
                <Link to="/privacy" className="hover:text-gold transition">
                  {ar ? "الخصوصية" : "Privacy"}
                </Link>
              </li>
              {pages.map((p) => (
                <li key={p.slug} data-live-id={`footer-page-row-${p.slug}`}>
                  <Link
                    data-live-id={`footer-page-${p.slug}`}
                    to="/page/$slug"
                    params={{ slug: p.slug }}
                    className="hover:text-gold transition"
                  >
                    {ar ? p.title_ar : p.title_en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3
              data-live-id="footer-contact-title"
              className="text-[11px] tracking-[0.2em] text-background/60 mb-4"
            >
              {ar ? "تواصل" : "Get in touch"}
            </h3>
            <ul className="space-y-2.5 text-[13px]">
              <li className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-1 shrink-0 text-gold" />
                <span data-live-id="footer-address">{address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-gold" />
                <a
                  data-live-id="footer-phone"
                  href={`tel:${CONTACT_PHONE_TEL}`}
                  dir="ltr"
                  className="hover:text-gold"
                >
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </li>
              {email && (
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gold" />
                  <a data-live-id="footer-email" href={`mailto:${email}`} className="hover:text-gold">
                    {email}
                  </a>
                </li>
              )}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              {ig && (
                <a
                  data-live-id="footer-social-instagram"
                  href={ig}
                  target="_blank"
                  rel="noopener"
                  aria-label="Instagram"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-background/20 hover:bg-background/10 transition"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {whatsappUrl && (
                <a
                  data-live-id="footer-social-whatsapp"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener"
                  aria-label="WhatsApp"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-background/20 hover:bg-background/10 transition"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              {tiktok && (
                <a
                  data-live-id="footer-social-tiktok"
                  href={tiktok}
                  target="_blank"
                  rel="noopener"
                  aria-label="TikTok"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-background/20 hover:bg-background/10 transition"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M19.32 6.69a4.83 4.83 0 0 1-3.78-1.85V15.4a5.6 5.6 0 1 1-5.6-5.6c.31 0 .6.03.9.08v2.94a2.74 2.74 0 1 0 1.97 2.63V2h2.74a4.84 4.84 0 0 0 3.77 4.69z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-background/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-background/55 tracking-soft">
          <span data-live-id="footer-copyright">
            © {new Date().getFullYear()} {BRAND_NAME}.{" "}
            {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </span>
        </div>
      </div>
    </footer>
  );
}
