import { supabase } from "@/integrations/supabase/client";

export type OverrideProp = "text" | "html" | "src" | "href" | "style";

export type OverrideRow = {
  id?: string;
  page_path: string;
  selector: string;
  prop: OverrideProp;
  lang: string;
  draft_value: any;
  published_value: any;
};

export type DraftMap = Record<
  string,
  { selector: string; prop: OverrideProp; lang: string; value: any; pagePath?: string }
>;

export const GLOBAL_HEADER_PATH = "__global_header__";
export const GLOBAL_FOOTER_PATH = "__global_footer__";
const keyOf = (selector: string, prop: OverrideProp, lang: string, pagePath = "") => `${pagePath}|${lang}|${prop}|${selector}`;

function effectiveLanguage(selector: string, prop: OverrideProp, lang: string) {
  // Styles, image sources, and link destinations are language-agnostic —
  // color/font/size/position/href/src do not differ between Arabic and English.
  // Only visible text/html is per-language.
  if (prop !== "text" && prop !== "html") return "*";
  // Phone and email are shared contact values, not translations. Historical
  // rows were saved under whichever language the admin happened to be using.
  if (prop === "text" && /data-live-id=["']footer-(phone|email)["']/.test(selector)) return "*";
  return lang;
}

/** Language slot to persist a draft under, based on the prop type. */
export function persistLangFor(prop: OverrideProp, lang: string, selector?: string) {
  if (prop !== "text" && prop !== "html") return "*";
  if (
    prop === "text" &&
    selector &&
    /data-live-id=["']footer-(phone|email)["']/.test(selector)
  )
    return "*";
  return lang;
}

/** Compute a stable CSS-ish path from [data-live-root] to el using nth-of-type. */
export function computeSelector(root: Element, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    const liveId = cur.getAttribute("data-live-id");
    if (liveId) {
      parts.unshift(`[data-live-id="${liveId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const tagName = cur.tagName;
    const sibs = Array.from(parent.children).filter((c: Element) => c.tagName === tagName);
    const idx = sibs.indexOf(cur) + 1;
    parts.unshift(`${tag}:nth-of-type(${idx})`);
    cur = parent;
  }
  return parts.join(">");
}

export function resolveSelector(root: Element, selector: string): Element | null {
  if (!selector) return null;
  try {
    return selector.startsWith("[data-live-id=")
      ? root.querySelector(selector)
      : root.querySelector(":scope>" + selector);
  } catch {
    return null;
  }
}

export async function loadOverrides(pagePath: string, includeDraft: boolean) {
  const { data, error } = await supabase
    .from("live_overrides")
    .select("page_path,selector,prop,lang,draft_value,published_value")
    .in("page_path", [pagePath, GLOBAL_HEADER_PATH, GLOBAL_FOOTER_PATH]);
  if (error) return [];
  const rows = (data ?? [])
    .sort((a: any, b: any) => Number(a.page_path !== pagePath) - Number(b.page_path !== pagePath))
    .map((r: any) => ({
      pagePath: r.page_path as string,
      selector: r.selector as string,
      prop: r.prop as OverrideProp,
      lang: effectiveLanguage(r.selector as string, r.prop as OverrideProp, r.lang as string),
      value: includeDraft ? (r.draft_value ?? r.published_value) : r.published_value,
    }))
    .filter((r) => r.value !== null && r.value !== undefined);
  // Repair historical contact edits where the admin changed only the anchor
  // destination. The visible value and clickable value are one logical field.
  for (const contact of [
    { selector: '[data-live-id="footer-email"]', prefix: /^mailto:/i },
    { selector: '[data-live-id="footer-phone"]', prefix: /^tel:/i },
  ]) {
    const href = [...rows].reverse().find((row) => row.selector === contact.selector && row.prop === "href");
    if (href) {
      const visible = String(href.value).replace(contact.prefix, "").trim();
      if (visible) rows.push({ ...href, prop: "text" as OverrideProp, lang: "*", value: visible });
    }
  }
  const deduped = new Map<string, (typeof rows)[number]>();
  rows.forEach((row) => deduped.set(`${row.lang}|${row.prop}|${row.selector}`, row));
  return [...deduped.values()];
}

export function applyOverrideToEl(el: Element, prop: OverrideProp, value: any) {
  if (value === null || value === undefined) return;
  switch (prop) {
    case "text":
      if (el.textContent !== String(value)) el.textContent = String(value);
      break;
    case "html":
      if ((el as HTMLElement).innerHTML !== String(value))
        (el as HTMLElement).innerHTML = String(value);
      break;
    case "src":
      if (el.tagName === "IMG") (el as HTMLImageElement).src = String(value);
      break;
    case "href":
      if (el.tagName === "A") (el as HTMLAnchorElement).href = String(value);
      break;
    case "style":
      if (value && typeof value === "object") {
        const style = value as Record<string, string>;
        if (style.display === "none") {
          (el as HTMLElement).hidden = true;
          (el as HTMLElement).setAttribute("aria-hidden", "true");
        } else if ((el as HTMLElement).hidden && style.display !== "none") {
          (el as HTMLElement).hidden = false;
          (el as HTMLElement).removeAttribute("aria-hidden");
        }
        Object.entries(value as Record<string, string>).forEach(([k, v]) => {
          if ((el as HTMLElement).style.getPropertyValue(k) !== String(v))
            (el as HTMLElement).style.setProperty(k, String(v));
        });
      }
      break;
  }
}

export async function persistDraft(pagePath: string, draft: DraftMap) {
  const rows = Object.values(draft).map((d) => ({
    page_path: d.pagePath ?? pagePath,
    selector: d.selector,
    prop: d.prop,
    lang: d.lang,
    draft_value: d.value,
  }));
  if (!rows.length) return { error: null };
  return await supabase
    .from("live_overrides")
    .upsert(rows, { onConflict: "page_path,selector,prop,lang" });
}

export async function publishDraft(pagePath: string, draft: DraftMap) {
  // Publish current drafts (and any existing draft_value on the page) by copying draft into published.
  // Upsert what we have in memory first.
  const persisted = await persistDraft(pagePath, draft);
  if (persisted.error) return { error: persisted.error };
  // Then promote all rows for this page: published_value = coalesce(draft_value, published_value)
  // Include global scopes even when the user saved a draft earlier and opened
  // the editor again. In that case the in-memory draft is empty, but the
  // header/footer draft values still need to be promoted on Publish.
  const scopes = [pagePath, GLOBAL_HEADER_PATH, GLOBAL_FOOTER_PATH];
  const { data, error: loadError } = await supabase
    .from("live_overrides")
    .select("id,draft_value,published_value")
    .in("page_path", scopes);
  if (loadError || !data) return { error: loadError ?? new Error("Could not load draft") };
  const updates = data
    .filter((r: any) => r.draft_value !== null && r.draft_value !== undefined)
    .map((r: any) =>
      supabase
        .from("live_overrides")
        .update({ published_value: r.draft_value, published_at: new Date().toISOString() })
        .eq("id", r.id),
    );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  return { error: failed?.error ?? null };
}

/** Discard every unpublished value and restore the last published storefront. */
export async function resetDraftToPublished(pagePath: string) {
  const { data, error } = await supabase
    .from("live_overrides")
    .select("id,published_value")
    .in("page_path", [pagePath, GLOBAL_HEADER_PATH, GLOBAL_FOOTER_PATH]);
  if (error || !data) return { error };
  const results = await Promise.all(
    data.map((row: any) =>
      supabase.from("live_overrides").update({ draft_value: row.published_value }).eq("id", row.id),
    ),
  );
  return { error: results.find((result) => result.error)?.error ?? null };
}

export { keyOf };
