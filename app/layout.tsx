import type { Metadata, Viewport } from 'next';
import { Inter, Sarabun, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

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
  title: 'AustamGood WMS - ระบบจัดการคลังสินค้า',
  description: 'ระบบจัดการคลังสินค้าสำหรับธุรกิจขนาดกลางและขนาดใหญ่',
  keywords: 'WMS, Warehouse Management, คลังสินค้า, จัดการสินค้า, AustamGood',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mobile WMS',
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
    >
      <body className={'h-full bg-white antialiased font-sans'}>
        {children}
      </body>
    </html>
  );
}
