/**
 * Reusable runtime DOM translation overlay.
 *
 * Walks all text nodes inside its subtree and replaces any text whose trimmed
 * value matches a key in ADMIN_AR_TO_EN / ADMIN_EN_TO_AR. Uses a
 * MutationObserver so dynamically rendered content is also translated.
 *
 * This is the SAME engine used by AdminShell, extracted so it can wrap the
 * entire storefront. With the bulk-translation dictionary in adminDict.ts,
 * choosing English mode now removes ~all hardcoded Arabic from the UI.
 *
 * Skips: <script>, <style>, <input>, <textarea>, [data-no-translate],
 * [contenteditable]. Does NOT mutate input values.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { ADMIN_AR_TO_EN, ADMIN_EN_TO_AR } from "@/i18n/adminDict";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA", "SVG"]);

const PRESENTATION_AR_TO_EN: Array<[RegExp, string]> = [
  [/٠/g, "0"], [/١/g, "1"], [/٢/g, "2"], [/٣/g, "3"], [/٤/g, "4"],
  [/٥/g, "5"], [/٦/g, "6"], [/٧/g, "7"], [/٨/g, "8"], [/٩/g, "9"],
  [/يناير/g, "January"], [/فبراير/g, "February"], [/مارس/g, "March"],
  [/أبريل/g, "April"], [/ابريل/g, "April"], [/مايو/g, "May"],
  [/يونيو/g, "June"], [/يوليو/g, "July"], [/أغسطس/g, "August"],
  [/اغسطس/g, "August"], [/سبتمبر/g, "September"], [/أكتوبر/g, "October"],
  [/اكتوبر/g, "October"], [/نوفمبر/g, "November"], [/ديسمبر/g, "December"],
  [/الأحد/g, "Sunday"], [/الاثنين/g, "Monday"], [/الإثنين/g, "Monday"],
  [/الثلاثاء/g, "Tuesday"], [/الأربعاء/g, "Wednesday"], [/الخميس/g, "Thursday"],
  [/الجمعة/g, "Friday"], [/السبت/g, "Saturday"],
  [/ر\.س/g, "SAR"], [/ريال/g, "SAR"],
  [/٬/g, ","], [/٫/g, "."], [/٪/g, "%"], [/،/g, ","],
];

function applyPresentation(text: string, toLang: "ar" | "en"): string {
  if (toLang !== "en") return text;
  return PRESENTATION_AR_TO_EN.reduce((acc, [re, val]) => acc.replace(re, val), text);
}

export function TranslateScope({
  enabled,
  toLang,
  children,
  scopeKey,
}: {
  enabled: boolean;
  toLang: "ar" | "en";
  children: ReactNode;
  scopeKey: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;

    function shouldSkip(node: Node): boolean {
      let el: Node | null = node;
      while (el && el !== root) {
        if (el.nodeType === 1) {
          const e = el as HTMLElement;
          if (SKIP_TAGS.has(e.tagName)) return true;
          if (e.hasAttribute?.("data-no-translate")) return true;
          if (e.getAttribute?.("contenteditable") === "true") return true;
        }
        el = (el as Node).parentNode;
      }
      return false;
    }

    function translateText(raw: string): string | null {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const dict = toLang === "en" ? ADMIN_AR_TO_EN : ADMIN_EN_TO_AR;
      let translated = dict[trimmed];
      if (!translated) {
        // try presentation normalization (numerals, months, currency)
        const norm = applyPresentation(trimmed, toLang);
        if (norm !== trimmed) translated = norm;
      }
      if (!translated || translated === trimmed) return null;
      const lead = raw.match(/^\s*/)?.[0] ?? "";
      const tail = raw.match(/\s*$/)?.[0] ?? "";
      return lead + translated + tail;
    }

    function walk(node: Node) {
      if (shouldSkip(node)) return;
      if (node.nodeType === 3) {
        const t = (node as Text).nodeValue ?? "";
        const next = translateText(t);
        if (next !== null) (node as Text).nodeValue = next;
        return;
      }
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        for (const attr of ["placeholder", "title", "aria-label", "alt"]) {
          const v = el.getAttribute?.(attr);
          if (v) {
            const next = translateText(v);
            if (next !== null) el.setAttribute(attr, next);
          }
        }
        node.childNodes.forEach(walk);
      }
    }

    const rescan = () => walk(root);
    rescan();
    const raf = typeof window !== "undefined" ? window.requestAnimationFrame(rescan) : 0;
    const t1 = typeof window !== "undefined" ? window.setTimeout(rescan, 120) : 0;
    const t2 = typeof window !== "undefined" ? window.setTimeout(rescan, 600) : 0;

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.nodeType === 3) {
          if (!shouldSkip(m.target)) {
            const t = (m.target as Text).nodeValue ?? "";
            const next = translateText(t);
            if (next !== null) (m.target as Text).nodeValue = next;
          }
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => walk(n));
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          const el = m.target as HTMLElement;
          const name = m.attributeName;
          if (name && ["placeholder", "title", "aria-label", "alt"].includes(name)) {
            const v = el.getAttribute(name);
            if (v) {
              const next = translateText(v);
              if (next !== null) el.setAttribute(name, next);
            }
          }
        }
      }
    });
    obs.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });
    return () => {
      obs.disconnect();
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      }
    };
  }, [enabled, scopeKey, toLang]);

  return <div ref={ref} className="contents">{children}</div>;
}
