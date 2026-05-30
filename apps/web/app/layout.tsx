import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'WC2026 Prediction Game',
  description: 'Game dự đoán FIFA World Cup 2026 — chơi vui, point ảo, không cá cược tiền thật.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0b6e4f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
