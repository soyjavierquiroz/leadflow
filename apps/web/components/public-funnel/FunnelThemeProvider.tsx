import type { CSSProperties, ReactNode } from 'react';

import { getFunnelThemeDefinition, resolveFunnelThemeId } from '@/lib/funnel-theme-registry';
import type {
  FunnelThemeButtonVariant,
  FunnelThemeEyebrowVariant,
  FunnelThemeSurfaceVariant,
  FunnelThemeTextVariant,
  ResolvedFunnelTheme,
} from "@/lib/funnel-theme.types";
import type { PublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime.types';

type FunnelThemeProviderProps = {
  runtime: PublicFunnelRuntimePayload;
  children: ReactNode;
  className?: string;
};

type FunnelThemeStyle = CSSProperties & Record<string, string>;

const eyebrowJustifyContentMap = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const applyTextVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  text: ResolvedFunnelTheme["primitives"]["text"][FunnelThemeTextVariant],
) => {
  style[`${prefix}-color`] = text.color;
  style[`${prefix}-font-family`] = text.fontFamily;
  style[`${prefix}-font-weight`] = String(text.fontWeight);
  style[`${prefix}-font-size`] = text.fontSize;
  style[`${prefix}-line-height`] = text.lineHeight;
  style[`${prefix}-letter-spacing`] = text.letterSpacing;
  style[`${prefix}-text-transform`] = text.textTransform;
};

const applySurfaceVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  surface: ResolvedFunnelTheme["primitives"]["surface"][FunnelThemeSurfaceVariant]["surface"],
) => {
  style[`${prefix}-bg`] = surface.backgroundColor;
  style[`${prefix}-border`] = surface.borderColor;
  style[`${prefix}-shadow`] = surface.shadow;
  style[`${prefix}-radius`] = surface.radius;
};

const applyEyebrowVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  eyebrow: ResolvedFunnelTheme["primitives"]["eyebrow"][FunnelThemeEyebrowVariant],
) => {
  applySurfaceVariables(style, prefix, eyebrow.surface);
  applyTextVariables(style, prefix, eyebrow.text);
  style[`${prefix}-padding-x`] = eyebrow.paddingX;
  style[`${prefix}-padding-y`] = eyebrow.paddingY;
  style[`${prefix}-alignment`] = eyebrow.alignment;
  style[`${prefix}-justify`] = eyebrowJustifyContentMap[eyebrow.alignment];
};

const applyButtonVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  button: ResolvedFunnelTheme["primitives"]["button"][FunnelThemeButtonVariant],
) => {
  for (const state of ["rest", "hover", "active", "focus", "disabled"] as const) {
    style[`${prefix}-${state}-bg`] = button.surface[state].backgroundColor;
    style[`${prefix}-${state}-border`] = button.surface[state].borderColor;
    style[`${prefix}-${state}-shadow`] = button.surface[state].shadow;
    style[`${prefix}-${state}-radius`] = button.surface[state].radius;
    style[`${prefix}-${state}-text-color`] = button.text[state].color;
    style[`${prefix}-${state}-font-family`] = button.text[state].fontFamily;
    style[`${prefix}-${state}-font-weight`] = String(button.text[state].fontWeight);
    style[`${prefix}-${state}-font-size`] = button.text[state].fontSize;
    style[`${prefix}-${state}-line-height`] = button.text[state].lineHeight;
    style[`${prefix}-${state}-letter-spacing`] = button.text[state].letterSpacing;
    style[`${prefix}-${state}-text-transform`] = button.text[state].textTransform;
  }

  style[`${prefix}-border-width`] = button.borderWidth;
  style[`${prefix}-outline-color`] = button.outlineColor;
  style[`${prefix}-outline-offset`] = button.outlineOffset;
  style[`${prefix}-gap`] = button.gap;
  style[`${prefix}-padding-x`] = button.paddingX;
  style[`${prefix}-padding-y`] = button.paddingY;
  style[`${prefix}-min-height`] = button.minHeight;
  style[`${prefix}-motion-duration`] = button.motion.duration;
  style[`${prefix}-motion-easing`] = button.motion.easing;
  style[`${prefix}-motion-transform`] = button.motion.transform;
};

const applyResolvedSectionSurfaceVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  theme: ResolvedFunnelTheme,
  surfaceVariant: FunnelThemeSurfaceVariant,
) => {
  applySurfaceVariables(style, prefix, theme.primitives.surface[surfaceVariant].surface);
};

const applyResolvedSectionTextVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  theme: ResolvedFunnelTheme,
  textVariant: FunnelThemeTextVariant,
) => {
  applyTextVariables(style, prefix, theme.primitives.text[textVariant]);
};

const applyResolvedSectionButtonVariables = (
  style: FunnelThemeStyle,
  prefix: string,
  theme: ResolvedFunnelTheme,
  buttonVariant: FunnelThemeButtonVariant,
) => {
  applyButtonVariables(style, prefix, theme.primitives.button[buttonVariant]);
};

export function FunnelThemeProvider({
  runtime,
  children,
  className,
}: FunnelThemeProviderProps) {
  const themeId = resolveFunnelThemeId(runtime.theme);
  const theme = getFunnelThemeDefinition(themeId);
  const eyebrowPill = theme.primitives.eyebrow.pill;
  const style: FunnelThemeStyle = {
    '--funnel-font-sans': theme.tokens.fonts.sans,
    '--funnel-font-display': theme.tokens.fonts.display,
    '--funnel-font-headline': theme.tokens.fonts.headline,
    '--funnel-font-body': theme.tokens.fonts.body,
    '--funnel-font-subheadline': theme.tokens.fonts.subheadline,
    '--funnel-font-mono': theme.tokens.fonts.mono,
    '--funnel-font-button': theme.tokens.fonts.button,
    '--funnel-vsl-accent': theme.tokens.brand.accent,
    '--funnel-vsl-highlight': theme.tokens.brand.highlight,
    '--funnel-eyebrow-background': eyebrowPill.surface.backgroundColor,
    '--funnel-eyebrow-text': eyebrowPill.text.color,
    '--funnel-eyebrow-alignment': eyebrowPill.alignment,
    '--funnel-eyebrow-justify': eyebrowJustifyContentMap[eyebrowPill.alignment],
    '--jakawi-font-sans': theme.tokens.fonts.body,
    '--jakawi-font-display': theme.tokens.fonts.display,
    '--theme-base-canvas': theme.tokens.base.canvas,
    '--theme-base-surface': theme.tokens.base.surface,
    '--theme-base-divider': theme.tokens.base.borderSubtle,
    '--theme-base-divider-strong': theme.tokens.base.borderStrong,
    '--theme-text-strong': theme.tokens.text.strong,
    '--theme-text-body': theme.tokens.text.body,
    '--theme-text-muted': theme.tokens.text.muted,
    '--theme-text-subtle': theme.tokens.text.subtle,
    '--theme-brand-trust': theme.tokens.brand.trust,
    '--theme-action-cta': theme.tokens.action.primary,
    '--theme-action-urgency': theme.tokens.action.urgency,
    '--theme-support-validation': theme.tokens.brand.success,
  };

  applyTextVariables(style, "--theme-text-headline", theme.primitives.text.headline);
  applyTextVariables(style, "--theme-text-body", theme.primitives.text.body);
  applyTextVariables(style, "--theme-text-subheadline", theme.primitives.text.subheadline);
  applyTextVariables(style, "--theme-text-eyebrow", theme.primitives.text.eyebrow);
  applyTextVariables(style, "--theme-text-caption", theme.primitives.text.caption);
  applyTextVariables(style, "--theme-text-price", theme.primitives.text.price);

  applySurfaceVariables(style, "--theme-surface-canvas", theme.primitives.surface.canvas.surface);
  applySurfaceVariables(style, "--theme-surface-section", theme.primitives.surface.section.surface);
  applySurfaceVariables(
    style,
    "--theme-surface-section-muted",
    theme.primitives.surface.sectionMuted.surface,
  );
  applySurfaceVariables(
    style,
    "--theme-surface-section-emphasis",
    theme.primitives.surface.sectionEmphasis.surface,
  );
  applySurfaceVariables(
    style,
    "--theme-surface-guarantee-coupon",
    theme.primitives.surface.guaranteeCoupon.surface,
  );
  applySurfaceVariables(style, "--theme-surface-overlay", theme.primitives.surface.overlay.surface);

  applyEyebrowVariables(style, "--theme-eyebrow-pill", theme.primitives.eyebrow.pill);
  applyEyebrowVariables(
    style,
    "--theme-eyebrow-attached",
    theme.primitives.eyebrow.attached,
  );

  applyButtonVariables(style, "--theme-button-primary", theme.primitives.button.primary);
  applyButtonVariables(style, "--theme-button-secondary", theme.primitives.button.secondary);
  applyButtonVariables(style, "--theme-button-urgency", theme.primitives.button.urgency);
  applyButtonVariables(style, "--theme-button-handoff", theme.primitives.button.handoff);

  style["--theme-announcement-emphasis"] = theme.sections.announcementBar.emphasisColor;
  style["--theme-section-hero-surface"] = theme.sections.heroHook.surface;
  style["--theme-section-hero-primary-cta"] = theme.sections.heroHook.primaryCta;
  style["--theme-section-guarantee-surface"] = theme.sections.guarantee.surface;
  style["--theme-section-guarantee-primary-cta"] = theme.sections.guarantee.primaryCta;
  style["--theme-section-guarantee-section-surface"] = theme.sections.guaranteeSection.surface;
  style["--theme-section-guarantee-section-primary-cta"] =
    theme.sections.guaranteeSection.primaryCta;
  style["--theme-section-final-cta-surface"] = theme.sections.finalCta.surface;
  style["--theme-section-final-cta-primary-cta"] = theme.sections.finalCta.primaryCta;
  style["--theme-section-offer-surface"] = theme.sections.offerStack.surface;
  style["--theme-section-offer-primary-cta"] = theme.sections.offerStack.primaryCta;
  style["--theme-section-offer-stack-surface"] = theme.sections.offerStack.surface;
  style["--theme-section-offer-stack-primary-cta"] = theme.sections.offerStack.primaryCta;
  style["--theme-section-handoff-surface"] = theme.sections.handoff.surface;
  style["--theme-section-handoff-primary-cta"] = theme.sections.handoff.primaryCta;
  style["--theme-section-sticky-bar-surface"] = theme.sections.stickyConversionBar.surface;
  style["--theme-section-sticky-bar-primary-cta"] =
    theme.sections.stickyConversionBar.primaryCta;
  style["--theme-section-capture-form-surface"] = theme.sections.captureForm.surface;
  style["--theme-section-capture-form-primary-cta"] =
    theme.sections.captureForm.primaryCta;

  applyResolvedSectionSurfaceVariables(
    style,
    "--theme-section-hero-hook",
    theme,
    theme.sections.heroHook.surface,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-hero-hook-headline",
    theme,
    theme.sections.heroHook.headline,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-hero-hook-text",
    theme,
    theme.sections.heroHook.body,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-hero-hook-supporting-text",
    theme,
    theme.sections.heroHook.supportingText,
  );
  applyResolvedSectionButtonVariables(
    style,
    "--theme-section-hero-hook-primary-cta",
    theme,
    theme.sections.heroHook.primaryCta,
  );

  applyResolvedSectionSurfaceVariables(
    style,
    "--theme-section-sticky-bar",
    theme,
    theme.sections.stickyConversionBar.surface,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-sticky-bar-text",
    theme,
    theme.sections.stickyConversionBar.text,
  );
  applyResolvedSectionButtonVariables(
    style,
    "--theme-section-sticky-bar-primary-cta",
    theme,
    theme.sections.stickyConversionBar.primaryCta,
  );
  applyResolvedSectionSurfaceVariables(
    style,
    "--theme-section-guarantee-section",
    theme,
    theme.sections.guaranteeSection.surface,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-guarantee-section-headline",
    theme,
    theme.sections.guaranteeSection.headline,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-guarantee-section-text",
    theme,
    theme.sections.guaranteeSection.body,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-guarantee-section-supporting-text",
    theme,
    theme.sections.guaranteeSection.supportingText,
  );
  applyResolvedSectionButtonVariables(
    style,
    "--theme-section-guarantee-section-primary-cta",
    theme,
    theme.sections.guaranteeSection.primaryCta,
  );
  applyResolvedSectionSurfaceVariables(
    style,
    "--theme-section-offer-stack",
    theme,
    theme.sections.offerStack.surface,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-offer-stack-headline",
    theme,
    theme.sections.offerStack.headline,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-offer-stack-text",
    theme,
    theme.sections.offerStack.body,
  );
  applyResolvedSectionTextVariables(
    style,
    "--theme-section-offer-stack-supporting-text",
    theme,
    theme.sections.offerStack.supportingText,
  );
  applyResolvedSectionButtonVariables(
    style,
    "--theme-section-offer-stack-primary-cta",
    theme,
    theme.sections.offerStack.primaryCta,
  );

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
