import type { NotificationProvider } from "./types";
import { wasenderProvider } from "./wasender";

const registry: Record<string, NotificationProvider> = {
  wasender: wasenderProvider,
};

export function getProvider(code: string): NotificationProvider | null {
  return registry[code] ?? null;
}

export function listProviderCodes(): string[] {
  return Object.keys(registry);
}
