import type { ReactNode } from "react";
import type { ThemeSectionInstance } from "@/new-storefront/theme-engine/types";

type SectionRendererProps = {
  section: ThemeSectionInstance;
  renderSection: (section: ThemeSectionInstance) => ReactNode;
};

const SectionRenderer = ({ section, renderSection }: SectionRendererProps) => {
  if (!section.visible) return null;

  return <>{renderSection(section)}</>;
};

export default SectionRenderer;
