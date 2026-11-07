import type { Metadata } from "next";
import "./globals.css";
import ActionFeedback from "@/components/ui/action-feedback";

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
      <body>
        <>
          <a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
          <ActionFeedback />
          {children}
        </>
      </body>
    </html>
  );
}
