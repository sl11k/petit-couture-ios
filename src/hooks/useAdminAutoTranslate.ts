/**
 * Admin DOM auto-translator.
 *
 * Scans the admin shell on every navigation / mutation, collects user-visible
 * text in the *opposite* language of the current admin language, asks the
 * `translate-batch` edge function to translate it, then swaps the rendered
 * text in place. Translations are cached in localStorage forever (until the
 * user clears it) so subsequent visits are instant and free.
 *
 * Why DOM-level instead of i18n keys: the admin has 39 pages with thousands
 * of inline strings — a key-based migration would be enormous and brittle.
 * This approach keeps every page authored in Arabic but renders it in
 * English (or vice-versa) on demand.
 *
 * Limitations: the AI may not translate units / dates / brand names — we
 * pin those via prompt rules. Inputs / textareas are translated for their
 * placeholder + value-placeholder only when explicitly tagged.
 */
import { useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

const CACHE_KEY = "lpp:admin-translate-cache:v1";
const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-batch`;

type Cache = Record<string, string>; // `${target}:${src}` -> translated

function loadCache(): Cache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota — drop silently */
  }
}

const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_RE = /[A-Za-z]{2,}/;

/** Should we translate this node's text content? */
function isTranslatableText(text: string, target: "en" | "ar") {
  const t = text.trim();
  if (!t || t.length < 2) return false;
  if (/^[\d\s.,:/+\-%×x*()[\]{}<>@#$£€!?'"·•|—–\\]+$/.test(t)) return false;
  if (target === "en") return ARABIC_RE.test(t);
  // target ar: only translate strings that look like English (avoid SKUs/codes)
  if (!LATIN_RE.test(t)) return false;
  if (ARABIC_RE.test(t)) return false;
  if (/^[A-Z0-9_-]{2,}$/.test(t)) return false; // codes
  return true;
}

/** Walk the subtree, collect translatable text nodes + tagged attributes. */
function collectTargets(root: HTMLElement, target: "en" | "ar") {
  const textNodes: Text[] = [];
  const placeholderEls: HTMLElement[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest("[data-no-translate]"))
            return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (
            tag === "SCRIPT" ||
            tag === "STYLE" ||
            tag === "CODE" ||
            tag === "PRE" ||
            tag === "TEXTAREA" ||
            tag === "INPUT"
          )
            return NodeFilter.FILTER_REJECT;
          if (!isTranslatableText(node.nodeValue || "", target))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        // element node — check placeholders
        const el = node as HTMLElement;
        if (el.closest("[data-no-translate]")) return NodeFilter.FILTER_SKIP;
        const ph = (el as HTMLInputElement).placeholder;
        if (ph && isTranslatableText(ph, target)) {
          placeholderEls.push(el);
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) textNodes.push(n as Text);
  }
  return { textNodes, placeholderEls };
}

/** Chunk into batches of N to stay below model context. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function translateBatch(
  texts: string[],
  target: "en" | "ar",
): Promise<string[]> {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ texts, target, context: "admin dashboard UI" }),
  });
  if (!resp.ok) throw new Error(`translate ${resp.status}`);
  const j = await resp.json();
  return Array.isArray(j.translations) ? j.translations : texts;
}

/**
 * Translate everything inside `root` to `target` language. Cached pairs are
 * applied synchronously; new pairs are fetched in batches and applied as they
 * resolve. Safe to call repeatedly — already-translated nodes are skipped.
 */
async function translateRoot(root: HTMLElement, target: "en" | "ar") {
  const { textNodes, placeholderEls } = collectTargets(root, target);
  if (!textNodes.length && !placeholderEls.length) return;

  const cache = loadCache();
  const pending: { src: string; apply: (out: string) => void }[] = [];

  // Apply cache + queue misses
  const queueText = (src: string, apply: (out: string) => void) => {
    const key = `${target}:${src}`;
    const hit = cache[key];
    if (hit) {
      apply(hit);
      return;
    }
    pending.push({ src, apply });
  };

  for (const node of textNodes) {
    const src = (node.nodeValue || "").trim();
    const leading = node.nodeValue?.match(/^\s*/)?.[0] ?? "";
    const trailing = node.nodeValue?.match(/\s*$/)?.[0] ?? "";
    queueText(src, (out) => {
      // Re-check parent existence — DOM may have changed during await.
      if (node.parentNode) node.nodeValue = leading + out + trailing;
    });
  }
  for (const el of placeholderEls) {
    const inputEl = el as HTMLInputElement;
    const src = inputEl.placeholder.trim();
    queueText(src, (out) => {
      inputEl.placeholder = out;
    });
  }

  if (pending.length === 0) return;

  // Deduplicate while preserving multiple appliers per source string
  const bySrc = new Map<string, ((out: string) => void)[]>();
  for (const p of pending) {
    if (!bySrc.has(p.src)) bySrc.set(p.src, []);
    bySrc.get(p.src)!.push(p.apply);
  }
  const uniqueSources = Array.from(bySrc.keys());

  const batches = chunk(uniqueSources, 40);
  for (const b of batches) {
    try {
      const translated = await translateBatch(b, target);
      const updates: Cache = {};
      b.forEach((src, i) => {
        const out = translated[i] || src;
        updates[`${target}:${src}`] = out;
        bySrc.get(src)?.forEach((fn) => fn(out));
      });
      const next = { ...loadCache(), ...updates };
      saveCache(next);
    } catch (e) {
      console.warn("translate-batch failed", e);
      // Leave originals in place; user sees Arabic mixed with English which
      // is still readable rather than a broken UI.
      break;
    }
  }
}

/**
 * React hook — mount once at the admin shell. Watches language changes and
 * DOM mutations and keeps the rendered admin in the chosen language.
 */
export function useAdminAutoTranslate(rootRef: React.RefObject<HTMLElement>) {
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const target = langRef.current === "en" ? "en" : "ar";
        // Only auto-translate when target is English (admin authored in AR).
        // For Arabic target we still run to cover any mixed-English strings.
        translateRoot(root, target).catch(() => {/* noop */});
      }, 120);
    };

    schedule();
    const obs = new MutationObserver(schedule);
    obs.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder"],
    });
    return () => {
      obs.disconnect();
      window.clearTimeout(timer);
    };
  }, [rootRef, lang]);
}
