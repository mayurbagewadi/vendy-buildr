import type {
  StorefrontThemeRuntimeDefinition,
  ThemeSettingField,
  ThemeSettingsSchema,
} from "@/new-storefront/theme-engine/types";

export const resolveThemeSettings = (
  runtime: StorefrontThemeRuntimeDefinition,
  storeSettings?: Record<string, unknown> | null
): Record<string, unknown> => ({
  ...runtime.defaultSettings,
  ...(storeSettings ?? {}),
});

const coerceThemeSettingValue = (field: ThemeSettingField, value: unknown) => {
  if (value === undefined || value === null) return field.defaultValue ?? null;

  if (field.type === "boolean") return Boolean(value);

  if (field.type === "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return field.defaultValue ?? field.min ?? 0;
    const minApplied = typeof field.min === "number" ? Math.max(field.min, numeric) : numeric;
    return typeof field.max === "number" ? Math.min(field.max, minApplied) : minApplied;
  }

  const textValue = String(value);

  if (field.type === "select") {
    const allowedValues = new Set((field.options ?? []).map((option) => option.value));
    if (allowedValues.size > 0 && !allowedValues.has(textValue)) {
      return field.defaultValue ?? field.options?.[0]?.value ?? "";
    }
  }

  return textValue;
};

export const sanitizeThemeSettings = (
  schema: ThemeSettingsSchema,
  input: Record<string, unknown>,
  defaults: Record<string, unknown> = {}
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const value = input[field.id] ?? defaults[field.id] ?? field.defaultValue;
    sanitized[field.id] = coerceThemeSettingValue(field, value);
  }

  return sanitized;
};
