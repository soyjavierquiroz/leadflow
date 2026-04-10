import type { FunnelThemeFontPairing, FunnelThemeId } from '@/lib/funnel-theme.types';

const geistSansStack =
  'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const geistMonoStack =
  'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const montserratStack =
  '"Montserrat", "Arial Narrow", var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif';
const merriweatherStack =
  '"Merriweather", Georgia, Cambria, "Times New Roman", Times, serif';

export const funnelThemeFonts = {
  default: {
    sans: geistSansStack,
    display: geistSansStack,
    body: geistSansStack,
    mono: geistMonoStack,
  },
  'expert-secrets': {
    sans: montserratStack,
    display: montserratStack,
    body: merriweatherStack,
    mono: geistMonoStack,
  },
} as const satisfies Record<FunnelThemeId, FunnelThemeFontPairing>;
