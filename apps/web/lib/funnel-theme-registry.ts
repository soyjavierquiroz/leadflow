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
              backgroundColor: "#f58320",
              borderColor: "#f58320",
              shadow:
                "0 10px 25px -5px rgba(245, 131, 32, 0.5), 0 8px 10px -6px rgba(245, 131, 32, 0.28)",
            },
            hover: {
              backgroundColor: "#e97814",
              borderColor: "#e97814",
              shadow:
                "0 18px 34px -8px rgba(245, 131, 32, 0.62), 0 12px 16px -10px rgba(122, 42, 0, 0.4)",
            },
            active: {
              backgroundColor: "#cf650c",
              borderColor: "#cf650c",
              shadow:
                "0 12px 22px -8px rgba(207, 101, 12, 0.58), 0 8px 12px -8px rgba(122, 42, 0, 0.35)",
            },
            focus: {
              backgroundColor: "#f58320",
              borderColor: "#f58320",
              shadow:
                "0 0 0 4px rgba(245, 131, 32, 0.26), 0 14px 30px -10px rgba(245, 131, 32, 0.42)",
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
        },
        body: {
          fontFamily: funnelThemeFonts["expert-secrets"].body,
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
    },
    sections: {
      heroHook: {
        eyebrow: "pill",
        primaryCta: "primary",
      },
      guarantee: {
        primaryCta: "primary",
      },
      finalCta: {
        primaryCta: "urgency",
      },
      offerStack: {
        primaryCta: "primary",
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
