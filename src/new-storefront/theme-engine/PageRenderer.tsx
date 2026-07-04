import type { ReactNode } from "react";
import SectionRenderer from "@/new-storefront/theme-engine/SectionRenderer";
import type { ThemeSectionInstance } from "@/new-storefront/theme-engine/types";

type PageRendererProps = {
  sections?: ThemeSectionInstance[];
  defaultSectionTypes: readonly string[];
  renderSection: (section: ThemeSectionInstance) => ReactNode;
};

const buildDefaultSections = (sectionTypes: readonly string[]): ThemeSectionInstance[] =>
  sectionTypes.map((type, index) => ({
    id: `${type}-${index + 1}`,
    type,
    order: index,
    visible: true,
    settings: {},
    blocks: [],
  }));

const resolveRenderableSections = (
  sections: ThemeSectionInstance[] | undefined,
  defaultSectionTypes: readonly string[]
) => {
  const allowedTypes = new Set(defaultSectionTypes);
  const source = sections?.length ? sections : buildDefaultSections(defaultSectionTypes);

  return source
    .filter((section) => allowedTypes.has(section.type))
    .sort((a, b) => a.order - b.order);
};

const PageRenderer = ({ sections, defaultSectionTypes, renderSection }: PageRendererProps) => {
  const renderableSections = resolveRenderableSections(sections, defaultSectionTypes);

  return (
    <>
      {renderableSections.map((section) => (
        <SectionRenderer key={section.id} section={section} renderSection={renderSection} />
      ))}
    </>
  );
};

export default PageRenderer;
