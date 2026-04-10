import type { CSSProperties, ReactNode } from 'react';

import { getFunnelThemeDefinition, resolveFunnelThemeId } from '@/lib/funnel-theme-registry';
import type { PublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime.types';

type FunnelThemeProviderProps = {
  runtime: PublicFunnelRuntimePayload;
  children: ReactNode;
  className?: string;
};

type FunnelThemeStyle = CSSProperties & Record<string, string>;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function FunnelThemeProvider({
  runtime,
  children,
  className,
}: FunnelThemeProviderProps) {
  const themeId = resolveFunnelThemeId(runtime.theme);
  const theme = getFunnelThemeDefinition(themeId);
  const style: FunnelThemeStyle = {
    '--funnel-font-sans': theme.fonts.sans,
    '--funnel-font-display': theme.fonts.display,
    '--funnel-font-headline': theme.fonts.headline,
    '--funnel-font-body': theme.fonts.body,
    '--funnel-font-subheadline': theme.fonts.subheadline,
    '--funnel-font-mono': theme.fonts.mono,
    '--funnel-font-button': theme.fonts.button,
    '--funnel-vsl-accent': theme.colors.vslAccent,
    '--funnel-vsl-highlight': theme.colors.vslHighlight,
    '--jakawi-font-sans': theme.fonts.body,
    '--jakawi-font-display': theme.fonts.display,
  };

  return (
    <div
      data-funnel-theme={themeId}
      className={cx('font-body text-slate-900', className)}
      style={style}
    >
      {children}
    </div>
  );
}
