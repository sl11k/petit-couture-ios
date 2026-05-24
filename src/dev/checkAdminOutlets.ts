/**
 * Dev-only runtime check: flag TanStack Router parent route files under
 * /admin that have child routes but do not render <Outlet />.
 *
 * Why a runtime check?
 *   The flat dot-separated route convention (admin.coupons.tsx is the parent
 *   layout for admin.coupons.$id.tsx) silently breaks when the parent forgets
 *   <Outlet />: the URL matches, but the page renders blank. We surface this
 *   in the dev console (and as a single toast-style warning) instead of
 *   waiting for a manual repro.
 *
 * This module is a no-op outside `import.meta.env.DEV` and outside the
 * browser. It must be imported from a route file (e.g. __root.tsx) so Vite
 * statically resolves the `import.meta.glob` call.
 */

type RouteSource = string;

// Eagerly read raw source of every admin route file at dev startup.
// `import.meta.glob` is statically analyzed by Vite — keep the pattern literal.
const adminRouteSources = import.meta.glob<RouteSource>(
  "/src/routes/admin*.{tsx,jsx}",
  { query: "?raw", import: "default", eager: true },
);

function fileToKey(path: string): string {
  // "/src/routes/admin.coupons.$id.tsx" → "admin.coupons.$id"
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.(tsx|jsx)$/, "");
}

function parentKey(key: string): string | null {
  const i = key.lastIndexOf(".");
  return i < 0 ? null : key.slice(0, i);
}

function hasOutletJSX(source: string): boolean {
  return /<\s*Outlet(\s|\/|>)/.test(source);
}

type Violation = { file: string; children: string[]; outletImported: boolean };

function computeViolations(): Violation[] {
  const entries = Object.entries(adminRouteSources);
  const keyToPath = new Map<string, string>();
  for (const [path] of entries) keyToPath.set(fileToKey(path), path);

  const childrenByParent = new Map<string, string[]>();
  for (const key of keyToPath.keys()) {
    const p = parentKey(key);
    if (p && keyToPath.has(p)) {
      const list = childrenByParent.get(p) ?? [];
      list.push(key);
      childrenByParent.set(p, list);
    }
  }

  const violations: Violation[] = [];
  for (const [parentKeyStr, children] of childrenByParent) {
    const parentPath = keyToPath.get(parentKeyStr)!;
    const source = adminRouteSources[parentPath] ?? "";
    if (!hasOutletJSX(source)) {
      violations.push({
        file: parentPath,
        children: children.map((k) => `${k}.tsx`),
        outletImported: /\bOutlet\b/.test(source) &&
          /from\s+["']@tanstack\/react-router["']/.test(source),
      });
    }
  }
  return violations;
}

let ran = false;

export function checkAdminOutlets(): void {
  if (ran) return;
  ran = true;
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return; // SSR no-op

  const violations = computeViolations();
  if (violations.length === 0) return;

  // Group log for easy scanning in DevTools.
  const label =
    `[admin-outlets] ${violations.length} parent route(s) under /admin have ` +
    `child routes but no <Outlet /> — those pages will render blank.`;

  // eslint-disable-next-line no-console
  console.groupCollapsed(`%c${label}`, "color:#b45309;font-weight:600");
  for (const v of violations) {
    const hint = v.outletImported
      ? "Outlet is imported but never rendered."
      : 'Outlet is not imported from "@tanstack/react-router".';
    // eslint-disable-next-line no-console
    console.warn(
      `${v.file}\n  children: ${v.children.join(", ")}\n  ${hint}\n  ` +
        "Fix: render <Outlet /> in this route's component.",
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}
