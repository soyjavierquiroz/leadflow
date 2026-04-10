export const funnelThemeIds = ['default', 'expert-secrets'] as const;

export type FunnelThemeId = (typeof funnelThemeIds)[number];

export type FunnelThemeFontPairing = {
  sans: string;
  display: string;
  headline: string;
  body: string;
  subheadline: string;
  mono: string;
  button: string;
};

export type FunnelThemeColorTokens = {
  vslAccent: string;
  vslHighlight: string;
};

export type FunnelThemeEyebrowAlignment = 'left' | 'center' | 'right';

export type FunnelThemeEyebrowTokens = {
  backgroundColor: string;
  textColor: string;
  alignment: FunnelThemeEyebrowAlignment;
};

export type FunnelThemeDefinition = {
  id: FunnelThemeId;
  name: string;
  description: string;
  fonts: FunnelThemeFontPairing;
  colors: FunnelThemeColorTokens;
  eyebrow: FunnelThemeEyebrowTokens;
};

export type FunnelThemeResolutionSource = 'runtime' | 'template' | 'fallback';

export type FunnelThemeResolutionInput = {
  themeId?: string | null;
  templateId?: string | null;
  templateCode?: string | null;
  templateName?: string | null;
};
