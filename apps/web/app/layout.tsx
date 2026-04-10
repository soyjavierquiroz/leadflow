import type { Metadata } from 'next';
import { funnelFontVariablesClassName } from '@/lib/funnel-font-loader';
import { webPublicConfig } from '@/lib/public-env';
import './globals.css';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${funnelFontVariablesClassName} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
