
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مدیریت پروژه | پنل مدیریت",
  description: "سامانه مدیریت پروژه، اسپرینت و وظایف",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
