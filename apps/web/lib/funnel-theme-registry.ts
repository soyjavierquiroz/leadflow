import { funnelThemeFonts } from '@/lib/funnel-theme-fonts';
import {
  funnelThemeIds,
  type FunnelThemeDefinition,
  type FunnelThemeId,
} from '@/lib/funnel-theme.types';

export const DEFAULT_FUNNEL_THEME_ID: FunnelThemeId = 'default';

export const funnelThemeRegistry = {
  default: {
    id: 'default',
    name: 'Default',
    description:
      'Baseline SaaS theme using the current Geist-forward stack and neutral Leadflow presentation defaults.',
    fonts: funnelThemeFonts.default,
  },
  'expert-secrets': {
    id: 'expert-secrets',
    name: 'Expert Secrets',
    description:
      'Direct response pairing with Montserrat headlines and Merriweather reading rhythm for more editorial funnels.',
    fonts: funnelThemeFonts['expert-secrets'],
  },
} as const satisfies Record<FunnelThemeId, FunnelThemeDefinition>;

export const availableFunnelThemes = funnelThemeIds.map(
  (themeId) => funnelThemeRegistry[themeId],
);

export const isFunnelThemeId = (value: unknown): value is FunnelThemeId =>
  typeof value === 'string' && value in funnelThemeRegistry;

export const resolveFunnelThemeId = (value: unknown): FunnelThemeId =>
  isFunnelThemeId(value) ? value : DEFAULT_FUNNEL_THEME_ID;

export const getFunnelThemeDefinition = (themeId: unknown): FunnelThemeDefinition =>
  funnelThemeRegistry[resolveFunnelThemeId(themeId)];
