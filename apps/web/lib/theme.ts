export const THEME_STORAGE_KEY = "leadflow-theme";
export const THEME_COOKIE_NAME = "leadflow-theme";

export type ThemeMode = "light" | "dark";

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";
