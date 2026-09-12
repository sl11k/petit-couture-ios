import type { NotificationProvider } from "./types";
import { wasenderProvider } from "./wasender";
import { metaCloudProvider } from "./meta-cloud";

const registry: Record<string, NotificationProvider> = {
  wasender: wasenderProvider,
  meta_cloud: metaCloudProvider,
};

export function getProvider(code: string): NotificationProvider | null {
  return registry[code] ?? null;
}

export function listProviderCodes(): string[] {
  return Object.keys(registry);
}
