/**
 * Tiny inline translation helper for admin pages.
 *
 * Usage inside a component:
 *   const tr = useTr();
 *   <h1>{tr("الطلبات", "Orders")}</h1>
 *
 * Returns the Arabic string when `lang === "ar"`, otherwise the English one.
 * Designed to keep admin pages bilingual without dragging the central
 * dictionary into every page.
 */
import { useLanguage } from "@/i18n/LanguageContext";

export type TrFn = (ar: string, en: string) => string;

export function useTr(): TrFn {
  const { lang } = useLanguage();
  return (ar: string, en: string) => (lang === "ar" ? ar : en);
}
