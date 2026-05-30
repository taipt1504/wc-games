import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GOLAZO — World Cup 2026 Prediction Game',
  description: 'Predict every World Cup 2026 match, climb the leaderboard, play with friends. Virtual points — no real-money betting.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#070B16',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
