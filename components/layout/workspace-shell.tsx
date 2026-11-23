"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, PanelsTopLeft, X } from "lucide-react";

import AppNav from "@/components/layout/app-nav";
import LogoutButton from "@/components/layout/logout-button";
import NotificationMenu from "@/components/layout/notification-menu";

type WorkspaceUser = {
  name: string;
  roleLabel: string;
  isPlatformAdmin: boolean;
  manageableCompanies: { id: string; name: string }[];
};

export default function WorkspaceShell({ children, user, projects, initialUnreadCount }: { children: ReactNode; user: WorkspaceUser; projects: { id: string; name: string; company: { id: string; name: string } }[]; initialUnreadCount: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = <AppNav isPlatformAdmin={user.isPlatformAdmin} manageableCompanies={user.manageableCompanies} projects={projects} variant="sidebar" onNavigate={() => setMenuOpen(false)} />;

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div dir="rtl" className="min-h-dvh bg-[var(--background)] lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="hidden border-l border-[var(--border)] bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">{navigation}</div>
        <SidebarUser user={user} />
      </aside>

      {menuOpen && <button type="button" aria-label="بستن منوی موبایل" className="fixed inset-0 z-[70] cursor-default bg-slate-950/35 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside id="mobile-navigation" aria-label="منوی موبایل" aria-hidden={!menuOpen} className={`fixed inset-y-0 right-0 z-[80] flex w-[min(18rem,86vw)] flex-col border-l border-[var(--border)] bg-white shadow-2xl transition-transform duration-200 lg:hidden ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><SidebarBrand compact /><button type="button" aria-label="بستن منو" onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-emerald-50"><X size={20} /></button></div>
        <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">{navigation}</div>
        <SidebarUser user={user} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="بازکردن منو" aria-controls="mobile-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-emerald-50 lg:hidden"><Menu size={20} /></button><div className="min-w-0"><p className="truncate text-sm font-extrabold text-[var(--foreground)]">سامانه مدیریت پروژه</p><p className="hidden text-xs text-[var(--muted)] sm:block">فضای کاری تیم</p></div></div>
          <div className="flex items-center gap-3"><NotificationMenu initialUnreadCount={initialUnreadCount} /><div className="hidden text-left sm:block"><p className="max-w-40 truncate text-xs font-bold text-[var(--foreground)]" title={user.name}>{user.name}</p><p className="text-[11px] text-[var(--muted)]">{user.roleLabel}</p></div><LogoutButton /></div>
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}

function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? "" : "border-b border-[var(--border)] px-5 py-5"}`}><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><PanelsTopLeft size={20} /></span><div><p className="text-sm font-extrabold text-[var(--foreground)]">مدیریت پروژه</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">Workspace</p></div></div>;
}

function SidebarUser({ user }: { user: WorkspaceUser }) {
  return <div className="border-t border-[var(--border)] p-4"><div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="truncate text-xs font-bold text-emerald-950" title={user.name}>{user.name}</p><p className="mt-0.5 text-[11px] text-emerald-700">{user.roleLabel}</p></div></div>;
}
