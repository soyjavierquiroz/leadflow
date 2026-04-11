export const funnelThemeIds = ["default", "expert-secrets"] as const;

export type FunnelThemeId = (typeof funnelThemeIds)[number];

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type ThemeState = "rest" | "hover" | "active" | "focus" | "disabled";

export type ThemeStateMap<T> = Record<ThemeState, T>;

export type FunnelThemeTextTransform =
  | "none"
  | "uppercase"
  | "lowercase"
  | "capitalize";

export type FunnelThemeEyebrowAlignment = "left" | "center" | "right";

export type FunnelThemeButtonVariant =
  | "primary"
  | "secondary"
  | "urgency"
  | "handoff";

export type FunnelThemeEyebrowVariant = "pill" | "attached";

export type FunnelThemeTextVariant =
  | "headline"
  | "body"
  | "subheadline"
  | "eyebrow"
  | "caption"
  | "price";

export type FunnelThemeSurfaceVariant =
  | "canvas"
  | "section"
  | "sectionMuted"
  | "sectionEmphasis"
  | "guaranteeCoupon"
  | "overlay"
  | "urgencySection";

export type FunnelThemeFontPairing = {
  sans: string;
  display: string;
  headline: string;
  body: string;
  subheadline: string;
  mono: string;
  button: string;
};

export type SurfaceStyle = {
  backgroundColor: string;
  borderColor: string;
  shadow: string;
  radius: string;
};

export type TextStyle = {
  color: string;
  fontFamily: string;
  fontWeight: string | number;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: FunnelThemeTextTransform;
};

export type MotionStyle = {
  duration: string;
  easing: string;
  transform: string;
};

export type FunnelThemeBaseTokens = {
  pageBackground: string;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  surfaceEmphasis: string;
  borderSubtle: string;
  borderStrong: string;
  overlay: string;
};

export type FunnelThemeTextTokens = {
  strong: string;
  body: string;
  muted: string;
  subtle: string;
  inverse: string;
  accent: string;
};

export type FunnelThemeBrandTokens = {
  trust: string;
  accent: string;
  highlight: string;
  success: string;
  warning: string;
  danger: string;
};

export type FunnelThemeActionTokens = {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  secondary: string;
  secondaryHover: string;
  secondaryActive: string;
  urgency: string;
  urgencyHover: string;
  urgencyActive: string;
};

export type FunnelThemeEffectTokens = {
  shadowXs: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;
  shadowCta: string;
  focusRingColor: string;
  focusRingOffsetColor: string;
};

export type FunnelThemeRadiusTokens = {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  pill: string;
};

export type FunnelThemeTokens = {
  base: FunnelThemeBaseTokens;
  text: FunnelThemeTextTokens;
  brand: FunnelThemeBrandTokens;
  action: FunnelThemeActionTokens;
  effects: FunnelThemeEffectTokens;
  radius: FunnelThemeRadiusTokens;
  fonts: FunnelThemeFontPairing;
};

export type ThemeButtonSlot = {
  surface: ThemeStateMap<SurfaceStyle>;
  text: ThemeStateMap<TextStyle>;
  borderWidth: string;
  outlineColor: string;
  outlineOffset: string;
  gap: string;
  paddingX: string;
  paddingY: string;
  minHeight: string;
  motion: MotionStyle;
};

export type ThemeEyebrowSlot = {
  surface: SurfaceStyle;
  text: TextStyle;
  paddingX: string;
  paddingY: string;
  alignment: FunnelThemeEyebrowAlignment;
};

export type ThemeSurfaceSlot = {
  surface: SurfaceStyle;
};

export type ThemePrimitives = {
  button: Record<FunnelThemeButtonVariant, ThemeButtonSlot>;
  eyebrow: Record<FunnelThemeEyebrowVariant, ThemeEyebrowSlot>;
  surface: Record<FunnelThemeSurfaceVariant, ThemeSurfaceSlot>;
  text: Record<FunnelThemeTextVariant, TextStyle>;
};

export type ThemeContentSection = {
  surface: FunnelThemeSurfaceVariant;
  eyebrow: FunnelThemeEyebrowVariant;
  headline: FunnelThemeTextVariant;
  body: FunnelThemeTextVariant;
  supportingText: FunnelThemeTextVariant;
  primaryCta: FunnelThemeButtonVariant;
  secondaryCta: FunnelThemeButtonVariant;
};

export type ThemeStickyConversionBarSection = {
  surface: FunnelThemeSurfaceVariant;
  text: FunnelThemeTextVariant;
  primaryCta: FunnelThemeButtonVariant;
};

export type ThemeAnnouncementBarSection = {
  surface: FunnelThemeSurfaceVariant;
  text: FunnelThemeTextVariant;
  emphasisColor: string;
};

export type ThemeCaptureFormSection = {
  surface: FunnelThemeSurfaceVariant;
  headline: FunnelThemeTextVariant;
  body: FunnelThemeTextVariant;
  primaryCta: FunnelThemeButtonVariant;
};

export type ThemeCaptureModalSlot = {
  surface: FunnelThemeSurfaceVariant;
  headline: FunnelThemeTextVariant;
  body: FunnelThemeTextVariant;
  primaryCta: FunnelThemeButtonVariant;
  overlayBackground: string;
  overlayBackdropBlur: string;
};

export type ThemeAuthorityBioSlot = {
  bg: string;
  text: string;
  expertName: string;
  primaryCta: FunnelThemeButtonVariant;
};

export type ThemeQualificationSlot = {
  bg: string;
  text: string;
  checkColor: string;
  crossColor: string;
  primaryCta: FunnelThemeButtonVariant;
};

export type ThemeSocialProofSlot = {
  bg: string;
  text: string;
  testimonialBg: string;
  testimonialBorder: string;
  primaryCta: FunnelThemeButtonVariant;
};

export type ThemeFaqAccordionSlot = {
  bg: string;
  textHeadline: string;
  textBody: string;
  accordionDivider: string;
  primaryCta: FunnelThemeButtonVariant;
};

export type ThemeSections = {
  heroHook: ThemeContentSection;
  guarantee: ThemeContentSection;
  guaranteeSection: ThemeContentSection;
  finalCta: ThemeContentSection;
  urgencySection: ThemeContentSection;
  offerStack: ThemeContentSection;
  handoff: ThemeContentSection;
  stickyConversionBar: ThemeStickyConversionBarSection;
  announcementBar: ThemeAnnouncementBarSection;
  captureForm: ThemeCaptureFormSection;
  captureModalSlot: ThemeCaptureModalSlot;
  authorityBioSlot: ThemeAuthorityBioSlot;
  qualificationSlot: ThemeQualificationSlot;
  socialProofSlot: ThemeSocialProofSlot;
  faqAccordionSlot: ThemeFaqAccordionSlot;
};

export type FunnelThemeDefinition = {
  id: FunnelThemeId;
  name: string;
  description: string;
  tokens?: DeepPartial<FunnelThemeTokens>;
  primitives?: DeepPartial<ThemePrimitives>;
  sections?: DeepPartial<ThemeSections>;
};

export type ResolvedFunnelTheme = {
  id: FunnelThemeId;
  name: string;
  description: string;
  tokens: FunnelThemeTokens;
  primitives: ThemePrimitives;
  sections: ThemeSections;
};

export type FunnelThemeResolutionSource = "runtime" | "template" | "fallback";

export type FunnelThemeResolutionInput = {
  themeId?: string | null;
  templateId?: string | null;
  templateCode?: string | null;
  templateName?: string | null;
};
