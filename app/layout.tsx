import type { Metadata } from "next";
import { Noto_Serif_SC, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

// 拉丁衬线(英文/数字),体积小,首屏 preload。
const sourceSerif = Source_Serif_4({
  variable: "--font-serif-latin",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: true,
});

// 中文宋体。CJK 字体很大,关掉 preload —— 汉字字形由浏览器按
// unicode-range 分片按需加载,不抢首屏带宽。
const notoSerifSC = Noto_Serif_SC({
  variable: "--font-serif-sc",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "财经新闻学习 Agent",
  description: "理解机制，积累概念",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${sourceSerif.variable} ${notoSerifSC.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-full flex-col md:flex-row">
          <Sidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
