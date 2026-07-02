import type { StorefrontThemeRuntimeDefinition } from "@/new-storefront/theme-engine/types";

export const resolveThemeSettings = (
  runtime: StorefrontThemeRuntimeDefinition,
  storeSettings?: Record<string, unknown> | null
): Record<string, unknown> => ({
  ...runtime.defaultSettings,
  ...(storeSettings ?? {}),
});
