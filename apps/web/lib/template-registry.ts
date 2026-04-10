import type { CSSProperties } from "react";

import {
  DEFAULT_FUNNEL_THEME_ID,
  getFunnelThemeDefinition,
  isFunnelThemeId,
} from "@/lib/funnel-theme-registry";
import type {
  FunnelThemeId,
  FunnelThemeResolutionInput,
  FunnelThemeResolutionSource,
} from "@/lib/funnel-theme.types";
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
  defaultThemeId: FunnelThemeId;
  supportedThemeIds: FunnelThemeId[];
  aliases?: string[];
};

export type TemplateThemePairing = {
  themeId: FunnelThemeId;
  source: FunnelThemeResolutionSource;
  template: TemplateRegistryEntry | null;
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
    defaultThemeId: "default",
    supportedThemeIds: ["default", "expert-secrets"],
    aliases: ["jakawi premium"],
  },
];

const normalizeTemplateLookup = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

export const getTemplateStyleById = (templateId?: string | null) => {
  const normalizedLookup = normalizeTemplateLookup(templateId);
  if (!normalizedLookup) {
    return null;
  }

  return (
    AVAILABLE_TEMPLATE_STYLES.find((template) => {
      return (
        template.id.trim().toLowerCase() === normalizedLookup ||
        template.name.trim().toLowerCase() === normalizedLookup ||
        template.aliases?.some((alias) => alias.trim().toLowerCase() === normalizedLookup)
      );
    }) ?? null
  );
};

export const resolveTemplateThemePairing = ({
  themeId,
  templateId,
  templateCode,
  templateName,
}: FunnelThemeResolutionInput): TemplateThemePairing => {
  const matchedTemplate =
    getTemplateStyleById(templateId) ??
    getTemplateStyleById(templateCode) ??
    getTemplateStyleById(templateName);

  if (isFunnelThemeId(themeId)) {
    return {
      themeId,
      source: "runtime",
      template: matchedTemplate,
    };
  }

  if (matchedTemplate) {
    return {
      themeId: matchedTemplate.defaultThemeId,
      source: "template",
      template: matchedTemplate,
    };
  }

  return {
    themeId: DEFAULT_FUNNEL_THEME_ID,
    source: "fallback",
    template: null,
  };
};

export const getResolvedTemplateTheme = (input: FunnelThemeResolutionInput) => {
  return getFunnelThemeDefinition(resolveTemplateThemePairing(input).themeId);
};
