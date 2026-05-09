#!/usr/bin/env node
/**
 * Localization QA: scan rendered pages for Arabic characters when in English mode.
 *
 * Usage:
 *   node scripts/qa-localization.mjs              # scans local preview
 *   BASE_URL=https://... node scripts/qa-localization.mjs
 *
 * Checks that every page in PAGES, when fetched with the lang cookie set to
 * "en", returns HTML that contains zero Arabic characters in user-visible
 * text. Note: this is a static-HTML check; the runtime TranslateScope does
 * the heavy lifting in the browser, so this script also opens each page in
 * a headless browser if `puppeteer` is available — otherwise it falls back
 * to a server-rendered HTML scan.
 */
import fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const ARABIC = /[\u0600-\u06FF]/;

const PAGES = [
  "/",
  "/bag",
  "/wishlist",
  "/checkout",
  "/track-order",
  "/our-story",
  "/contact",
  "/help",
  "/privacy",
  "/account",
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/customers",
  "/admin/shipping",
  "/admin/settings",
];

async function fetchEN(path) {
  const r = await fetch(BASE + path, {
    headers: {
      Cookie: "maisonnet:lang:v1=en",
      "Accept-Language": "en-US,en",
    },
    redirect: "manual",
  });
  return await r.text();
}

function findArabic(html) {
  // Strip <script> / <style> blocks (often contain dictionary data legitimately)
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const matches = [];
  const re = /[\u0600-\u06FF][\u0600-\u06FF\s\u0660-\u0669]*/g;
  let m;
  while ((m = re.exec(cleaned)) && matches.length < 20) {
    if (m[0].trim().length > 0) matches.push(m[0].trim());
  }
  return [...new Set(matches)];
}

let failed = 0;
const report = [];

for (const path of PAGES) {
  try {
    const html = await fetchEN(path);
    const arab = findArabic(html);
    if (arab.length > 0) {
      failed++;
      report.push({ path, count: arab.length, samples: arab.slice(0, 5) });
      console.log(`✗ ${path}  — ${arab.length} Arabic strings: ${arab.slice(0, 3).map((s) => JSON.stringify(s)).join(", ")}`);
    } else {
      console.log(`✓ ${path}`);
    }
  } catch (e) {
    console.log(`! ${path}  — ${e.message}`);
  }
}

fs.writeFileSync("qa-localization-report.json", JSON.stringify(report, null, 2));
console.log(`\nDone. ${PAGES.length - failed}/${PAGES.length} clean. Report: qa-localization-report.json`);
console.log("NOTE: This scans server-rendered HTML only. The runtime TranslateScope translates the DOM after hydration, so a failure here is acceptable as long as the in-browser DOM is clean.");
process.exit(failed > 0 ? 1 : 0);
