import { describe, it, expect } from "vitest";
import { breadcrumbJsonLd, SITE } from "./seo";

// Unicode bi-di control characters used by withDirIsolate
const RLM = "\u200F";
const LRM = "\u200E";
const FSI = "\u2068";
const PDI = "\u2069";

describe("breadcrumbJsonLd", () => {
  it("wraps Arabic names with RLM + FSI/PDI isolates", () => {
    const data = breadcrumbJsonLd([
      { name: "الرئيسية", path: "/" },
      { name: "الأقسام", path: "/category" },
    ]);
    const items = data.itemListElement;
    for (const it of items) {
      expect(it.name.startsWith(RLM)).toBe(true);
      expect(it.name.includes(FSI)).toBe(true);
      expect(it.name.endsWith(PDI)).toBe(true);
    }
  });

  it("wraps Latin/mixed names with LRM + isolates", () => {
    const data = breadcrumbJsonLd([{ name: "Maisonnét 2026", path: "/about" }]);
    const name = data.itemListElement[0].name as string;
    expect(name.startsWith(LRM)).toBe(true);
    expect(name.includes(FSI) && name.includes(PDI)).toBe(true);
  });

  it("preserves the underlying display text inside the isolates", () => {
    const original = "الأقسام";
    const data = breadcrumbJsonLd([{ name: original, path: "/category" }]);
    const name = data.itemListElement[0].name as string;
    // strip control chars and verify the readable text is intact
    const stripped = name.replace(/[\u200E\u200F\u2068\u2069]/g, "");
    expect(stripped).toBe(original);
  });

  it("never double-wraps already isolated text", () => {
    const pre = `${RLM}${FSI}مرحبا${PDI}`;
    const data = breadcrumbJsonLd([{ name: pre, path: "/" }]);
    const name = data.itemListElement[0].name as string;
    // FSI should appear exactly once
    expect((name.match(/\u2068/g) || []).length).toBe(1);
  });

  it("always emits absolute URLs in item field for relative paths", () => {
    const data = breadcrumbJsonLd([
      { name: "الرئيسية", path: "/" },
      { name: "الأقسام", path: "/category" },
      { name: "فساتين", path: "/category/dresses" },
    ]);
    for (const it of data.itemListElement) {
      expect(typeof it.item).toBe("string");
      expect(it.item).toMatch(/^https?:\/\//);
      expect((it.item as string).startsWith(SITE.url)).toBe(true);
    }
  });

  it("preserves absolute URLs as-is without re-canonicalizing", () => {
    const abs = "https://cdn.example.com/page";
    const data = breadcrumbJsonLd([{ name: "External", path: abs }]);
    expect(data.itemListElement[0].item).toBe(abs);
  });

  it("assigns sequential 1..N positions and BreadcrumbList type", () => {
    const data = breadcrumbJsonLd([
      { name: "أ", path: "/" },
      { name: "ب", path: "/b" },
      { name: "ج", path: "/c" },
    ]);
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data["@context"]).toBe("https://schema.org");
    data.itemListElement.forEach((it: any, i: number) => {
      expect(it["@type"]).toBe("ListItem");
      expect(it.position).toBe(i + 1);
    });
  });

  it("sets inLanguage default to ar-SA and respects override", () => {
    expect(breadcrumbJsonLd([{ name: "x", path: "/" }]).inLanguage).toBe("ar-SA");
    expect(
      breadcrumbJsonLd([{ name: "x", path: "/" }], { inLanguage: "en-US" }).inLanguage,
    ).toBe("en-US");
  });
});
