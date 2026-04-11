import { funnelBaseTheme } from "@/lib/funnel-base-theme";
import { funnelThemeFonts } from "@/lib/funnel-theme-fonts";
import {
  funnelThemeIds,
  type DeepPartial,
  type FunnelThemeDefinition,
  type FunnelThemeId,
  type ResolvedFunnelTheme,
} from '@/lib/funnel-theme.types';

export const DEFAULT_FUNNEL_THEME_ID: FunnelThemeId = 'default';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const deepMerge = <T extends Record<string, unknown>>(
  base: T,
  override?: DeepPartial<T>,
): T => {
  if (!override) {
    return { ...base };
  }

  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override) as Array<keyof T>) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (overrideValue === undefined) {
      continue;
    }

    if (isRecord(baseValue) && isRecord(overrideValue)) {
      result[key as string] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as DeepPartial<Record<string, unknown>>,
      );
      continue;
    }

    result[key as string] = overrideValue;
  }

  return result as T;
};

export const funnelThemeRegistry = {
  default: {
    id: 'default',
    name: 'Default',
    description:
      'Baseline SaaS theme using the current Geist-forward stack and neutral Leadflow presentation defaults.',
    tokens: {
      fonts: funnelThemeFonts.default,
    },
  },
  'expert-secrets': {
    id: 'expert-secrets',
    name: 'Expert Secrets',
    description:
      'Direct response theme with a fully unified Montserrat stack across headlines, bridge copy, body text, and CTA treatments for editorial VSL funnels.',
    tokens: {
      fonts: funnelThemeFonts["expert-secrets"],
      brand: {
        trust: "#0ea5e9",
        accent: "#cc3333",
        highlight: "#ffea00",
      },
      action: {
        primary: "#f58320",
        primaryHover: "#ff9a3d",
        primaryActive: "#dd6b0f",
        urgency: "#cc3333",
        urgencyHover: "#de4b4b",
        urgencyActive: "#a72b2b",
      },
    },
    primitives: {
      button: {
        primary: {
          surface: {
            rest: {
              backgroundColor: "#1e73be",
              borderColor: "#1e73be",
              shadow:
                "0 10px 25px -5px rgba(30, 115, 190, 0.45), 0 8px 10px -6px rgba(30, 115, 190, 0.24)",
            },
            hover: {
              backgroundColor: "#0f66b3",
              borderColor: "#0f66b3",
              shadow:
                "0 18px 34px -8px rgba(30, 115, 190, 0.56), 0 12px 16px -10px rgba(11, 69, 120, 0.34)",
            },
            active: {
              backgroundColor: "#0b599b",
              borderColor: "#0b599b",
              shadow:
                "0 12px 22px -8px rgba(11, 89, 155, 0.52), 0 8px 12px -8px rgba(8, 59, 103, 0.3)",
            },
            focus: {
              backgroundColor: "#1e73be",
              borderColor: "#1e73be",
              shadow:
                "0 0 0 4px rgba(30, 115, 190, 0.24), 0 14px 30px -10px rgba(30, 115, 190, 0.4)",
            },
          },
          text: {
            rest: {
              color: "#ffffff",
              fontFamily:
                'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 800,
            },
            hover: {
              color: "#ffffff",
              fontFamily:
                'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 800,
            },
            active: {
              color: "#ffffff",
              fontFamily:
                'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 800,
            },
            focus: {
              color: "#ffffff",
              fontFamily:
                'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 800,
            },
            disabled: {
              color: "#ffffff",
              fontFamily:
                'var(--font-manrope), var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 800,
            },
          },
          motion: {
            duration: "200ms",
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            transform: "translateY(-4px) scale(1.02)",
          },
        },
        urgency: {
          surface: {
            rest: {
              backgroundColor: "#cc3333",
              borderColor: "#cc3333",
              shadow: "0 18px 44px rgba(204, 51, 51, 0.3)",
            },
            hover: {
              backgroundColor: "#de4b4b",
              borderColor: "#de4b4b",
            },
            active: {
              backgroundColor: "#a72b2b",
              borderColor: "#a72b2b",
            },
          },
        },
      },
      eyebrow: {
        pill: {
          surface: {
            backgroundColor: "#e6f7ff",
            borderColor: "#bfdbfe",
            radius: "9999px",
          },
          text: {
            color: "#000000",
            fontFamily: funnelThemeFonts["expert-secrets"].subheadline,
            fontWeight: 800,
          },
          alignment: "center",
        },
        attached: {
          surface: {
            backgroundColor: "#e6f7ff",
            borderColor: "#bfdbfe",
            radius: "9999px",
          },
          text: {
            color: "#000000",
            fontFamily: funnelThemeFonts["expert-secrets"].subheadline,
            fontWeight: 800,
          },
          alignment: "center",
        },
      },
      text: {
        headline: {
          fontFamily: funnelThemeFonts["expert-secrets"].headline,
          fontWeight: 900,
          fontSize: "clamp(2rem, 4.6vw, 3.35rem)",
        },
        body: {
          fontFamily: funnelThemeFonts["expert-secrets"].body,
          color: "#2d2d2d",
        },
        subheadline: {
          fontFamily: funnelThemeFonts["expert-secrets"].subheadline,
          fontWeight: 600,
        },
        eyebrow: {
          fontFamily: funnelThemeFonts["expert-secrets"].subheadline,
          fontWeight: 800,
        },
        price: {
          fontFamily: funnelThemeFonts["expert-secrets"].headline,
          fontWeight: 900,
        },
      },
      surface: {
        overlay: {
          surface: {
            backgroundColor: "#ffffff",
            borderColor: "#eaeaea",
            shadow: "none",
            radius: "0",
          },
        },
        guaranteeCoupon: {
          surface: {
            backgroundColor: "#fafafa",
            borderColor: "#0ea5e9",
            shadow: "0 18px 45px rgba(15, 23, 42, 0.06)",
            radius: "2rem",
          },
        },
        urgencySection: {
          surface: {
            backgroundColor: "#fff5f5",
            borderColor: "#fecaca",
            shadow: "0 18px 45px rgba(204, 51, 51, 0.08)",
            radius: "2rem",
          },
        },
      },
    },
    sections: {
      heroHook: {
        eyebrow: "pill",
        primaryCta: "primary",
      },
      guarantee: {
        primaryCta: "primary",
      },
      guaranteeSection: {
        surface: "guaranteeCoupon",
        headline: "headline",
        body: "body",
        supportingText: "caption",
        primaryCta: "primary",
      },
      finalCta: {
        primaryCta: "urgency",
      },
      urgencySection: {
        surface: "urgencySection",
        headline: "headline",
        body: "body",
        supportingText: "subheadline",
        primaryCta: "urgency",
      },
      offerStack: {
        surface: "sectionMuted",
        headline: "headline",
        body: "body",
        supportingText: "caption",
        primaryCta: "primary",
        secondaryCta: "secondary",
      },
      stickyConversionBar: {
        surface: "overlay",
        text: "body",
        primaryCta: "primary",
      },
      captureModalSlot: {
        surface: "section",
        headline: "headline",
        body: "body",
        primaryCta: "primary",
        overlay: "rgba(0, 0, 0, 0.8)",
      },
      authorityBioSlot: {
        bg: "#edf6ff",
        text: "#24303f",
        expertName: "#1e73be",
        primaryCta: "primary",
      },
      qualificationSlot: {
        bg: "#ffffff",
        text: "#24303f",
        checkColor: "#1f9d55",
        crossColor: "#cc3333",
        primaryCta: "primary",
      },
      socialProofSlot: {
        bg: "#f8f8f8",
        text: "#2d2d2d",
        testimonialBg: "#ffffff",
        testimonialBorder: "#d9dee7",
        primaryCta: "secondary",
      },
      faqAccordionSlot: {
        bg: "#fafafa",
        textHeadline: "#1f2937",
        textBody: "#4b5563",
        accordionDivider: "#e5e7eb",
        primaryCta: "secondary",
      },
    },
  },
} as const satisfies Record<FunnelThemeId, FunnelThemeDefinition>;

const resolveThemeDefinition = (
  themeDefinition: FunnelThemeDefinition,
): ResolvedFunnelTheme => {
  return {
    id: themeDefinition.id,
    name: themeDefinition.name,
    description: themeDefinition.description,
    tokens: deepMerge(funnelBaseTheme.tokens, themeDefinition.tokens),
    primitives: deepMerge(funnelBaseTheme.primitives, themeDefinition.primitives),
    sections: deepMerge(funnelBaseTheme.sections, themeDefinition.sections),
  };
};

export const availableFunnelThemes = funnelThemeIds.map((themeId) =>
  resolveThemeDefinition(funnelThemeRegistry[themeId]),
);

export const isFunnelThemeId = (value: unknown): value is FunnelThemeId =>
  typeof value === 'string' && value in funnelThemeRegistry;

export const resolveFunnelThemeId = (value: unknown): FunnelThemeId =>
  isFunnelThemeId(value) ? value : DEFAULT_FUNNEL_THEME_ID;

export const getFunnelThemeDefinition = (themeId: unknown): ResolvedFunnelTheme =>
  resolveThemeDefinition(funnelThemeRegistry[resolveFunnelThemeId(themeId)]);
