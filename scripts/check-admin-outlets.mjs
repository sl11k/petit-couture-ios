#!/usr/bin/env node
/**
 * Flag TanStack Router parent route files under /admin that have child routes
 * but do not render an <Outlet />.
 *
 * Background: in TanStack Router's flat dot-separated routing, a file like
 *   src/routes/admin.coupons.tsx
 * is the parent layout for any sibling file whose name starts with
 *   admin.coupons.<something>.tsx
 * (e.g. admin.coupons.index.tsx, admin.coupons.$id.tsx).
 *
 * If the parent route's component never renders <Outlet />, navigating to a
 * child URL matches successfully but the page renders blank. This script
 * catches that class of bug at build/dev time.
 *
 * Usage:
 *   node scripts/check-admin-outlets.mjs           # exits 1 on violations
 *   node scripts/check-admin-outlets.mjs --warn    # exits 0, just warns
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const ROUTES_DIR = resolve(process.cwd(), "src/routes");
const PREFIX = "admin";
const WARN_ONLY = process.argv.includes("--warn");

function listAdminRouteFiles() {
  let entries;
  try {
    entries = readdirSync(ROUTES_DIR);
  } catch {
    console.error(`[check-admin-outlets] cannot read ${ROUTES_DIR}`);
    process.exit(WARN_ONLY ? 0 : 1);
  }
  return entries.filter((f) => {
    if (!f.endsWith(".tsx") && !f.endsWith(".jsx")) return false;
    if (!(f === `${PREFIX}.tsx` || f.startsWith(`${PREFIX}.`))) return false;
    try {
      return statSync(join(ROUTES_DIR, f)).isFile();
    } catch {
      return false;
    }
  });
}

/** Convert "admin.coupons.$id.tsx" → "admin.coupons.$id" (segment path key). */
function fileToKey(file) {
  return file.replace(/\.(tsx|jsx)$/, "");
}

/** Parent of "admin.coupons.$id" is "admin.coupons" (drop last dot segment). */
function parentKey(key) {
  const i = key.lastIndexOf(".");
  if (i < 0) return null;
  return key.slice(0, i);
}

function hasOutletJSX(source) {
  // Match <Outlet ... /> or <Outlet>...</Outlet>, ignoring whitespace.
  return /<\s*Outlet(\s|\/|>)/.test(source);
}

function importsOutlet(source) {
  // Catch the typical import; if Outlet is used without being imported the
  // build will already fail, but we still report the missing-JSX case.
  return /from\s+["']@tanstack\/react-router["']/.test(source) &&
    /\bOutlet\b/.test(source);
}

function main() {
  const files = listAdminRouteFiles();
  const keys = new Set(files.map(fileToKey));

  // A file is a "parent with children" if some other key has it as parent.
  const childrenByParent = new Map();
  for (const key of keys) {
    const p = parentKey(key);
    if (p && keys.has(p)) {
      if (!childrenByParent.has(p)) childrenByParent.set(p, []);
      childrenByParent.get(p).push(key);
    }
  }

  const violations = [];
  for (const [parent, children] of childrenByParent) {
    const file = `${parent}.tsx`;
    let source;
    try {
      source = readFileSync(join(ROUTES_DIR, file), "utf8");
    } catch {
      continue;
    }
    if (!hasOutletJSX(source)) {
      violations.push({
        file,
        children: children.map((k) => `${k}.tsx`),
        hint: importsOutlet(source)
          ? "Outlet is imported but never rendered."
          : "Outlet is not imported from @tanstack/react-router.",
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      `[check-admin-outlets] OK — checked ${files.length} admin route file(s); ` +
        `no parent routes missing <Outlet />.`,
    );
    return 0;
  }

  const header = `[check-admin-outlets] Found ${violations.length} admin parent route(s) ` +
    `with child routes but no <Outlet /> in the component:`;
  if (WARN_ONLY) console.warn(header);
  else console.error(header);

  for (const v of violations) {
    const line =
      `  • src/routes/${v.file}\n` +
      `      children: ${v.children.join(", ")}\n` +
      `      ${v.hint}\n` +
      `      Fix: render <Outlet /> from "@tanstack/react-router" in this route's component.`;
    if (WARN_ONLY) console.warn(line);
    else console.error(line);
  }

  return WARN_ONLY ? 0 : 1;
}

process.exit(main());
