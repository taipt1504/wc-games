import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/provider';
import { normalizeLocale, LOCALE_COOKIE } from '@/lib/i18n/locales';

export const metadata: Metadata = {
  title: 'World Cup Games — World Cup 2026 Prediction Game',
  description: 'Predict every World Cup 2026 match, climb the leaderboard, play with friends. Virtual points — no real-money betting.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#070B16',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body>
        <div className="app-bg" aria-hidden />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
