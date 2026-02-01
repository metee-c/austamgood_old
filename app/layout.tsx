import type { Metadata, Viewport } from 'next';
import { Inter, Sarabun, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun',
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans-thai',
});

export const metadata: Metadata = {
  title: 'WMS - ระบบจัดการคลังสินค้า',
  description: 'ระบบจัดการคลังสินค้าสำหรับธุรกิจขนาดกลางและขนาดใหญ่',
  keywords: 'WMS, Warehouse Management, คลังสินค้า, จัดการสินค้า',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/images/favicon-v2.svg', type: 'image/svg+xml' },
    ],
    apple: '/images/favicon-v2.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WMS',
  },
  other: {
    charset: 'UTF-8',
  },
};

export const viewport: Viewport = {
  themeColor: '#0099FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${sarabun.variable} ${notoSansThai.variable} h-full`}
      suppressHydrationWarning
    >
      <body className={'h-full bg-white antialiased font-sans'}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
