import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import AppNav from "@/components/layout/app-nav";
import LogoutButton from "@/components/layout/logout-button";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-16 border-b border-[var(--border)] bg-white" />}>
      <WorkspaceContent>{children}</WorkspaceContent>
    </Suspense>
  );
}

async function WorkspaceContent({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-extrabold text-white" aria-hidden="true">پ</span>
            <span className="hidden text-sm font-extrabold text-[var(--foreground)] sm:block">مدیریت پروژه</span>
          </div>
          <div className="order-3 w-full sm:order-none sm:w-auto"><AppNav role={user.role} /></div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-36 truncate text-xs text-[var(--muted)] lg:block" title={user.name}>{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
