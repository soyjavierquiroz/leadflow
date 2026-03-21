import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { webPublicConfig } from '@/lib/public-env';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
