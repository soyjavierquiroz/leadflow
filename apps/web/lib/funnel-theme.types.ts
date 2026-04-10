export const funnelThemeIds = ['default', 'expert-secrets'] as const;

export type FunnelThemeId = (typeof funnelThemeIds)[number];

export type FunnelThemeFontPairing = {
  sans: string;
  display: string;
  body: string;
  mono: string;
};

export type FunnelThemeDefinition = {
  id: FunnelThemeId;
  name: string;
  description: string;
  fonts: FunnelThemeFontPairing;
};

export type FunnelThemeResolutionSource = 'runtime' | 'template' | 'fallback';

export type FunnelThemeResolutionInput = {
  themeId?: string | null;
  templateId?: string | null;
  templateCode?: string | null;
  templateName?: string | null;
};
