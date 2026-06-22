import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultThemeConfig, normalizeThemeConfig } from "./defaults";
import type { ThemeConfig } from "./types";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "lpp.visual-theme.v1";
type Value = {
  config: ThemeConfig;
  hasSavedTheme: boolean;
  save: (v: ThemeConfig) => Promise<void>;
  reset: () => Promise<void>;
};
const Context = createContext<Value | null>(null);

function valid(value: unknown): value is ThemeConfig {
  const v = value as ThemeConfig;
  return !!v && v.version === 1 && !!v.global && Array.isArray(v.sections);
}

export function ThemeCustomizerProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(defaultThemeConfig);
  const [hasSavedTheme, setHasSavedTheme] = useState(false);
  useEffect(() => {
    let active = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (valid(parsed)) {
          setConfig(normalizeThemeConfig(parsed));
          setHasSavedTheme(true);
        }
      }
    } catch {
      /* ignore malformed local data */
    }
    // Generated Supabase types will include this table after the migration is regenerated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("theme_customizations" as never) as any)
      .select("config")
      .eq("scope", "storefront")
      .maybeSingle()
      .then(({ data }: { data: { config?: unknown } | null }) => {
        if (active && valid(data?.config)) {
          const normalized = normalizeThemeConfig(data.config);
          setConfig(normalized);
          setHasSavedTheme(true);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const g = config.global;
    const root = document.documentElement;
    root.style.setProperty("--primary", g.primaryColor);
    root.style.setProperty("--accent", g.secondaryColor);
    root.style.setProperty("--background", g.backgroundColor);
    root.style.setProperty("--foreground", g.textColor);
    root.style.setProperty("--card", g.cardColor);
    root.style.setProperty("--radius", `${g.borderRadius}px`);
    root.style.setProperty("--button-radius", `${g.buttonRadius}px`);
    root.style.setProperty("--theme-font-scale", String(g.fontSizeScale));
    root.style.setProperty("--theme-spacing-scale", String(g.spacingScale));
    root.dataset.headerStyle = g.headerStyle;
    root.dataset.cardStyle = g.productCardStyle;
    root.dataset.appBackground = g.appBackgroundStyle;
  }, [config]);
  const value = useMemo<Value>(
    () => ({
      config,
      hasSavedTheme,
      async save(v) {
        const next = { ...v, updatedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setConfig(next);
        setHasSavedTheme(true);
        const { data: auth } = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("theme_customizations" as never) as any).upsert(
          {
            scope: "storefront",
            config: next,
            updated_by: auth.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "scope" },
        );
        if (error) throw new Error(error.message);
      },
      async reset() {
        const next = { ...defaultThemeConfig, updatedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setConfig(next);
        setHasSavedTheme(true);
        const { data: auth } = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("theme_customizations" as never) as any).upsert(
          {
            scope: "storefront",
            config: next,
            updated_by: auth.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "scope" },
        );
        if (error) throw new Error(error.message);
      },
    }),
    [config, hasSavedTheme],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useThemeCustomizer() {
  const value = useContext(Context);
  if (!value) throw new Error("useThemeCustomizer must be inside ThemeCustomizerProvider");
  return value;
}
