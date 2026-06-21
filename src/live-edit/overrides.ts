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

export type DraftMap = Record<string, { selector: string; prop: OverrideProp; lang: string; value: any }>;

const keyOf = (selector: string, prop: OverrideProp, lang: string) => `${lang}|${prop}|${selector}`;

/** Compute a stable CSS-ish path from [data-live-root] to el using nth-of-type. */
export function computeSelector(root: Element, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
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
    return root.querySelector(":scope>" + selector);
  } catch {
    return null;
  }
}

export async function loadOverrides(pagePath: string, includeDraft: boolean) {
  const { data, error } = await supabase
    .from("live_overrides")
    .select("selector,prop,lang,draft_value,published_value")
    .eq("page_path", pagePath);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    selector: r.selector as string,
    prop: r.prop as OverrideProp,
    lang: r.lang as string,
    value: includeDraft ? (r.draft_value ?? r.published_value) : r.published_value,
  })).filter((r) => r.value !== null && r.value !== undefined);
}

export function applyOverrideToEl(el: Element, prop: OverrideProp, value: any) {
  if (value === null || value === undefined) return;
  switch (prop) {
    case "text":
      if (el.textContent !== String(value)) el.textContent = String(value);
      break;
    case "html":
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
        Object.entries(value as Record<string, string>).forEach(([k, v]) => {
          (el as HTMLElement).style.setProperty(k, v as string);
        });
      }
      break;
  }
}

export async function persistDraft(pagePath: string, draft: DraftMap) {
  const rows = Object.values(draft).map((d) => ({
    page_path: pagePath,
    selector: d.selector,
    prop: d.prop,
    lang: d.lang,
    draft_value: d.value,
  }));
  if (!rows.length) return { error: null };
  return await supabase.from("live_overrides").upsert(rows, { onConflict: "page_path,selector,prop,lang" });
}

export async function publishDraft(pagePath: string, draft: DraftMap) {
  // Publish current drafts (and any existing draft_value on the page) by copying draft into published.
  // Upsert what we have in memory first.
  await persistDraft(pagePath, draft);
  // Then promote all rows for this page: published_value = coalesce(draft_value, published_value)
  const { data } = await supabase
    .from("live_overrides")
    .select("id,draft_value,published_value")
    .eq("page_path", pagePath);
  if (!data) return;
  const updates = data
    .filter((r: any) => r.draft_value !== null && r.draft_value !== undefined)
    .map((r: any) =>
      supabase
        .from("live_overrides")
        .update({ published_value: r.draft_value, published_at: new Date().toISOString() })
        .eq("id", r.id),
    );
  await Promise.all(updates);
}

export { keyOf };
