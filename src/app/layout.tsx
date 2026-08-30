import type { Metadata } from 'next';
import { Inter_Tight, Manrope } from 'next/font/google';

import { appConfig } from '@/config/app.config';
import { buildMetadata } from '@/lib/seo';

import './globals.css';

/**
 * Two faces, one per surface.
 *
 *   Inter Tight — the public site. Tight, editorial, holds up at 52px display
 *                 sizes without feeling generic.
 *   Manrope     — the admin. Slightly rounded, excellent tabular figures for
 *                 stat panels and data rows.
 */
const site = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-site',
});

const admin = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-admin',
});

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.url),
  ...buildMetadata(),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${site.variable} ${admin.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
