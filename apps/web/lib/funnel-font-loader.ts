import { Geist, Geist_Mono, Inter, Manrope, Montserrat } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
});

export const funnelFontVariablesClassName = [
  geistSans.variable,
  geistMono.variable,
  inter.variable,
  manrope.variable,
  montserrat.variable,
].join(' ');
