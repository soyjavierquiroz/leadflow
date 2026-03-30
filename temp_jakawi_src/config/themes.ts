export const THEMES = {
  'core-fuego': {
    primary: '#ef4444',
    accent: '#f59e0b',
    bg: '#f8fafc',
    text: '#0f172a',
    cardBg: '#ffffff',
    borderColor: '#e2e8f0',
  },
  'core-eco': {
    primary: '#0d9488',
    accent: '#14b8a6',
    bg: '#f0fdfa',
    text: '#134e4a',
    cardBg: '#ffffff',
    borderColor: '#14b8a6',
  },
  'cyber-matrix': {
    primary: '#22c55e',
    accent: '#eab308',
    bg: '#050505',
    text: '#ecfccb',
    cardBg: '#111827',
    borderColor: '#166534',
  },
  'cyber-synth': {
    primary: '#0ea5e9',
    accent: '#ec4899',
    bg: '#0f172a',
    text: '#f8fafc',
    cardBg: '#1e293b',
    borderColor: '#334155',
  },
  'aura-mono': {
    primary: '#111827',
    accent: '#6b7280',
    bg: '#ffffff',
    text: '#111827',
    cardBg: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  'aura-rose': {
    primary: '#be123c',
    accent: '#d97706',
    bg: '#fffbfb',
    text: '#4c0519',
    cardBg: '#ffffff',
    borderColor: '#ffe4e6',
  },
} as const

export type ThemeKey = keyof typeof THEMES
