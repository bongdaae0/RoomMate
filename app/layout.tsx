import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Room-Manager | 1인 가구 생활 관리 서비스",
  description: "Next.js와 TypeScript로 구현한 1인 가구 통합 생활 관리 포트폴리오",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-extrabold text-lg text-indigo-600">
              🏠 Room-Manager
            </Link>
            <div className="flex items-center gap-6 text-sm font-semibold">
              <Link
                href="/"
                className="text-slate-600 hover:text-indigo-600 transition"
              >
                식재료 · 공과금
              </Link>
              <Link
                href="/supplies"
                className="text-slate-600 hover:text-teal-600 transition"
              >
                생필품 교체주기
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}