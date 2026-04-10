import type { CSSProperties, ReactNode } from 'react';

import { funnelThemeFonts } from '@/lib/funnel-theme-fonts';
import { resolveFunnelThemeId } from '@/lib/funnel-theme-registry';
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
  const fontPairing = funnelThemeFonts[themeId];
  const style: FunnelThemeStyle = {
    '--funnel-font-sans': fontPairing.sans,
    '--funnel-font-display': fontPairing.display,
    '--funnel-font-headline': fontPairing.display,
    '--funnel-font-body': fontPairing.body,
    '--funnel-font-mono': fontPairing.mono,
    '--jakawi-font-sans': fontPairing.body,
    '--jakawi-font-display': fontPairing.display,
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
