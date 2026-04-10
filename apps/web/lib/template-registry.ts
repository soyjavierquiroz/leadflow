import type { CSSProperties } from "react";

import {
  jakawiPremiumClassNames,
  jakawiPremiumThemeStyle,
} from "@/styles/templates/jakawi-premium";

export type TemplateRegistryEntry = {
  id: string;
  name: string;
  description: string;
  styleModulePath: string;
  themeStyle: CSSProperties;
  classNames: Record<string, string>;
};

export const AVAILABLE_TEMPLATE_STYLES: TemplateRegistryEntry[] = [
  {
    id: "jakawi-premium",
    name: "Jakawi Premium",
    description:
      "Template visual premium oficial para funnels editoriales con tokens compartidos entre layout sticky, bloques comerciales y captura.",
    styleModulePath: "@/styles/templates/jakawi-premium",
    themeStyle: jakawiPremiumThemeStyle,
    classNames: jakawiPremiumClassNames,
  },
];

export const getTemplateStyleById = (templateId: string) => {
  return AVAILABLE_TEMPLATE_STYLES.find((template) => template.id === templateId) ?? null;
};
