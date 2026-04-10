import type { CSSProperties } from "react";

export const jakawiPremiumThemeStyle = {
  "--jakawi-font-sans":
    "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  "--jakawi-font-display":
    "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  "--jakawi-surface-dark": "#020617",
  "--jakawi-text-on-dark": "#f8fafc",
  "--jakawi-page-bg": "#f7f8fb",
  "--jakawi-content-bg": "#ffffff",
  "--jakawi-media-bg":
    "radial-gradient(circle at top, rgba(45,212,191,0.22), transparent 34%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
  "--jakawi-text-main": "#0f172a",
  "--jakawi-text-soft": "#475569",
  "--jakawi-text-muted": "#64748b",
  "--jakawi-border-soft": "rgba(148, 163, 184, 0.22)",
  "--jakawi-border-strong": "#cbd5e1",
  "--jakawi-accent": "#fb923c",
  "--jakawi-accent-strong": "#f97316",
  "--jakawi-accent-ring": "rgba(251, 146, 60, 0.22)",
  "--jakawi-success": "#10b981",
  "--jakawi-success-ring": "rgba(16, 185, 129, 0.16)",
  "--jakawi-warm": "#f59e0b",
  "--jakawi-shadow-soft": "0 22px 70px rgba(15, 23, 42, 0.08)",
  "--jakawi-shadow-card": "0 18px 55px rgba(15, 23, 42, 0.08)",
  "--jakawi-shadow-button": "0 18px 44px rgba(249, 115, 22, 0.28)",
  "--jakawi-shadow-modal": "0 30px 90px rgba(15, 23, 42, 0.35)",
  "--jakawi-input-border": "#e2e8f0",
  "--jakawi-input-focus": "#fb923c",
  "--jakawi-input-ring": "rgba(251, 146, 60, 0.18)",
} as CSSProperties;

export const jakawiPremiumSurfaceToneClasses = {
  brand:
    "border-white/15 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.16),_transparent_28%),linear-gradient(135deg,_rgba(2,6,23,0.98)_0%,_rgba(15,23,42,0.95)_52%,_rgba(30,41,59,0.98)_100%)] text-white shadow-[0_34px_110px_rgba(15,23,42,0.28)]",
  neutral:
    "border-[var(--jakawi-border-soft)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.96)_100%)] text-[var(--jakawi-text-main)] shadow-[var(--jakawi-shadow-soft)]",
  warm:
    "border-amber-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,_rgba(255,251,235,0.98)_0%,_rgba(255,255,255,0.96)_100%)] text-[var(--jakawi-text-main)] shadow-[0_22px_70px_rgba(217,119,6,0.12)]",
  success:
    "border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(180deg,_rgba(236,253,245,0.98)_0%,_rgba(255,255,255,0.96)_100%)] text-[var(--jakawi-text-main)] shadow-[0_22px_70px_rgba(5,150,105,0.12)]",
} as const;

export const jakawiPremiumClassNames = {
  scope:
    "bg-[var(--jakawi-page-bg)] text-[var(--jakawi-text-main)] [font-family:var(--jakawi-font-sans)]",
  splitFrame: "grid min-h-screen lg:grid-cols-2 lg:gap-0",
  stickyMediaPanel:
    "hidden overflow-hidden [background:var(--jakawi-media-bg)] lg:block lg:sticky lg:top-0 lg:h-screen",
  contentPanel:
    "min-h-screen bg-[var(--jakawi-content-bg)] px-6 pb-8 pt-0 text-[var(--jakawi-text-main)] lg:px-20 lg:pb-12 lg:pt-8",
  contentInner: "mx-auto w-full max-w-[44rem] space-y-12",
  title:
    "text-left text-4xl font-extrabold uppercase tracking-tighter text-[var(--jakawi-text-main)] lg:text-5xl",
  primaryButton:
    "font-button inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--jakawi-accent-strong)] px-6 py-4 text-center text-sm font-black uppercase tracking-tight text-white shadow-[var(--jakawi-shadow-button)] transition-all duration-200 hover:scale-[1.01] hover:bg-[var(--jakawi-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400",
  secondaryButton:
    "font-button inline-flex items-center justify-center gap-2 rounded-full border border-[var(--jakawi-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--jakawi-text-main)] transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400",
  input:
    "rounded-[1.15rem] border border-[var(--jakawi-input-border)] bg-white px-4 py-3.5 text-sm text-[var(--jakawi-text-main)] outline-none transition placeholder:text-[var(--jakawi-text-muted)] focus:border-[var(--jakawi-input-focus)] focus:ring-4 focus:ring-[var(--jakawi-input-ring)]",
  compactInput:
    "h-12 w-full rounded-2xl border border-[var(--jakawi-input-border)] bg-white px-4 text-base text-[var(--jakawi-text-main)] outline-none transition placeholder:text-[var(--jakawi-text-muted)] focus:border-[var(--jakawi-input-focus)] focus:ring-4 focus:ring-[var(--jakawi-input-ring)]",
  modalPanel:
    "rounded-[2rem] border border-white/80 bg-white p-6 shadow-[var(--jakawi-shadow-modal)] md:p-7",
  phoneInputShell:
    "flex w-full flex-row items-center overflow-hidden rounded-2xl border bg-white transition-all duration-200",
  phoneInputValid:
    "border-[var(--jakawi-input-border)] focus-within:border-[var(--jakawi-input-focus)] focus-within:ring-4 focus-within:ring-[var(--jakawi-input-ring)]",
  phoneInputField:
    "[&_.PhoneInputCountry]:bg-transparent [&_.PhoneInputCountryIcon]:h-4 [&_.PhoneInputCountryIcon]:w-6 [&_.PhoneInputCountryIcon]:rounded-sm [&_.PhoneInputCountryIcon]:shadow-sm [&_.PhoneInputInput]:h-12 [&_.PhoneInputInput]:min-w-0 [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:text-base [&_.PhoneInputInput]:text-[var(--jakawi-text-main)] [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:placeholder:text-[var(--jakawi-text-muted)]",
} as const;
