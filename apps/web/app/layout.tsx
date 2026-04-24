import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/app-shell/theme-provider';
import { funnelFontVariablesClassName } from '@/lib/funnel-font-loader';
import { webPublicConfig } from '@/lib/public-env';
import {
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  isThemeMode,
  type ThemeMode,
} from '@/lib/theme';
import './globals.css';

const themeBootstrapScript = `
(() => {
  try {
    const storageKey = '${THEME_STORAGE_KEY}';
    const cookieKey = '${THEME_COOKIE_NAME}';
    const storedTheme = window.localStorage.getItem(storageKey);
    const cookieMatch = document.cookie.match(new RegExp('(?:^|; )' + cookieKey + '=([^;]*)'));
    const cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const theme =
      storedTheme === 'dark' || storedTheme === 'light'
        ? storedTheme
        : cookieTheme === 'dark' || cookieTheme === 'light'
          ? cookieTheme
        : systemTheme;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(storageKey, theme);
    document.cookie = cookieKey + '=' + theme + '; Path=/; Max-Age=31536000; SameSite=Lax';
  } catch (_error) {}
})();
`;

const metadataBase = (() => {
  try {
    return new URL(webPublicConfig.urls.site);
  } catch {
    return new URL('http://localhost:3000');
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: webPublicConfig.appName,
    template: `%s | ${webPublicConfig.appName}`,
  },
  description:
    'Leadflow centraliza captacion, asignacion y automatizacion operativa de leads.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme: ThemeMode = isThemeMode(cookieTheme) ? cookieTheme : 'light';

  return (
    <html
      lang="es"
      suppressHydrationWarning
      data-theme={initialTheme}
      className={`${funnelFontVariablesClassName} h-full antialiased ${
        initialTheme === 'dark' ? 'dark' : ''
      }`}
      style={{ colorScheme: initialTheme }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full bg-app-bg text-app-text">
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
