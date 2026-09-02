import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "零售业 AI 审计系统",
  description: "面向零售行业审计场景的统一 AI 审计工作台。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
