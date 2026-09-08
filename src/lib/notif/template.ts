// Variable + conditional interpolation engine. Isomorphic (client & server).
// Supports: {{var}}, {{var|fallback}}, {{#var}}...{{/var}} conditional sections,
// and dotted paths {{order.total}}.

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

export function renderTemplate(body: string, vars: Record<string, any> = {}): string {
  if (!body) return "";
  let out = body;
  // Conditional blocks {{#name}}...{{/name}}
  out = out.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, inner) => {
    const v = getPath(vars, key);
    return v ? inner : "";
  });
  // Variables with optional |fallback
  out = out.replace(/\{\{\s*([\w.]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g, (_m, key, fallback) => {
    const v = getPath(vars, key);
    if (v == null || v === "") return (fallback ?? "").trim();
    return String(v);
  });
  return out;
}

export function extractVariables(body: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*#?\/?([\w.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return Array.from(set);
}
