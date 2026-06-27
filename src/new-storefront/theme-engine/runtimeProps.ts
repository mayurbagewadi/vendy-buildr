import type { StorefrontThemeRuntimeDefinition } from "@/new-storefront/theme-engine/types";
import type { ThemeRuntimeContext } from "@/new-storefront/theme-engine/types";

export const buildThemeRuntimeContext = (
  runtime: StorefrontThemeRuntimeDefinition
): ThemeRuntimeContext => ({
  themeId: runtime.id,
  themeSlug: runtime.slug,
  themeVersion: runtime.version,
  template: runtime.template,
});
