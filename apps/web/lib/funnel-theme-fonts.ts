import type { FunnelThemeFontPairing, FunnelThemeId } from '@/lib/funnel-theme.types';

const geistSansStack =
  'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const geistMonoStack =
  'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const manropeStack =
  'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const montserratStack =
  'var(--font-montserrat), "Arial Narrow", var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif';

export const funnelThemeFonts = {
  default: {
    sans: geistSansStack,
    display: geistSansStack,
    headline: geistSansStack,
    body: geistSansStack,
    subheadline: geistSansStack,
    mono: geistMonoStack,
    button: geistSansStack,
  },
  'expert-secrets': {
    sans: montserratStack,
    display: montserratStack,
    headline: montserratStack,
    body: montserratStack,
    subheadline: montserratStack,
    mono: manropeStack,
    button: montserratStack,
  },
} as const satisfies Record<FunnelThemeId, FunnelThemeFontPairing>;
