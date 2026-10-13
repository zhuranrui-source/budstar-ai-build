import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { siteMetadata } from './site-metadata';

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="ops-body">
        {children}
        {/* ADR-0010：PWA Service Worker（仅静态缓存） */}
        <Script id="budstar-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function () {
                /* 注册失败不阻塞应用 */
              });
            });
          }
        `}</Script>
      </body>
    </html>
  );
}
