import type {
  StorefrontThemeRuntimeDefinition,
  ThemePageData,
  ThemeSectionInstance,
  ThemeSectionSchema,
  ThemeSettingField,
} from "@/new-storefront/theme-engine/types";

const MAX_SECTIONS_PER_PAGE = 25;
const MAX_BLOCKS_PER_SECTION = 50;

const coerceSettingValue = (field: ThemeSettingField, value: unknown) => {
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

const defaultSectionSettings = (section: ThemeSectionSchema) => {
  const settings: Record<string, unknown> = {};

  for (const field of section.settings ?? []) {
    settings[field.id] = field.defaultValue ?? null;
  }

  return settings;
};

const sanitizeSectionSettings = (
  section: ThemeSectionSchema,
  input: Record<string, unknown> | undefined
) => {
  const settings: Record<string, unknown> = {};

  for (const field of section.settings ?? []) {
    settings[field.id] = coerceSettingValue(field, input?.[field.id] ?? field.defaultValue);
  }

  return settings;
};

const defaultSectionsForPage = (
  runtime: StorefrontThemeRuntimeDefinition,
  page: ThemePageData["page"]
): ThemeSectionInstance[] =>
  runtime.sectionSchema
    .filter((section) => section.page === page)
    .slice(0, MAX_SECTIONS_PER_PAGE)
    .map((section, index) => ({
      id: `${section.type}-${index + 1}`,
      type: section.type,
      order: index,
      visible: section.defaultVisible !== false,
      settings: defaultSectionSettings(section),
      blocks: [],
    }));

export const normalizeThemePageLayout = (
  runtime: StorefrontThemeRuntimeDefinition,
  page: ThemePageData["page"],
  pageLayout?: Record<string, unknown> | null
): { sections: ThemeSectionInstance[] } => {
  const sectionSchemas = runtime.sectionSchema.filter((section) => section.page === page);
  const schemaByType = new Map(sectionSchemas.map((section) => [section.type, section]));
  const rawSections = pageLayout?.sections;

  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    return { sections: defaultSectionsForPage(runtime, page) };
  }

  const sections = rawSections
    .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === "object")
    .map((section, index) => {
      const type = typeof section.type === "string" ? section.type : "";
      const schema = schemaByType.get(type);
      if (!schema) return null;

      const blocks = Array.isArray(section.blocks)
        ? section.blocks
            .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object")
            .slice(0, MAX_BLOCKS_PER_SECTION)
            .map((block, blockIndex) => ({
              id: typeof block.id === "string" && block.id ? block.id : `${type}-block-${blockIndex + 1}`,
              type: typeof block.type === "string" ? block.type : "content",
              settings: typeof block.settings === "object" && block.settings !== null
                ? (block.settings as Record<string, unknown>)
                : {},
            }))
        : [];

      return {
        id: typeof section.id === "string" && section.id ? section.id : `${type}-${index + 1}`,
        type,
        order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
        visible: section.visible !== false,
        settings: sanitizeSectionSettings(
          schema,
          typeof section.settings === "object" && section.settings !== null
            ? (section.settings as Record<string, unknown>)
            : undefined
        ),
        blocks,
      };
    })
    .filter((section): section is ThemeSectionInstance => Boolean(section))
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_SECTIONS_PER_PAGE);

  return { sections: sections.length > 0 ? sections : defaultSectionsForPage(runtime, page) };
};
