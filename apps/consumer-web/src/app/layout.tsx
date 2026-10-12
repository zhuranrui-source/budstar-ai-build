import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '星芽 AI｜青少年 AI 创造力课程',
  description:
    '面向 6–15 岁青少年的 AI 创造力课程，从真实问题出发，完成作品并沉淀成长记录。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="prototype-body">{children}</body>
    </html>
  );
}
