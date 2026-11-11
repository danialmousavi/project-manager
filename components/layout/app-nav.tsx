"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, LayoutDashboard, Timer, UsersRound } from "lucide-react";

export default function AppNav({ role }: { role: "ADMIN" | "MANAGER" | "EMPLOYEE" }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
    { href: "/projects", label: "پروژه‌ها", icon: FolderKanban },
    { href: "/overtime", label: "اضافه‌کار", icon: Timer },
    ...(role === "ADMIN" ? [{ href: "/users", label: "کاربران", icon: UsersRound }] : []),
  ];
  return <nav aria-label="ناوبری اصلی" className="flex min-w-0 flex-wrap justify-center gap-1 sm:justify-start">{links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || (href === "/projects" && pathname.startsWith("/projects/"));
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${active ? "bg-emerald-600 text-white" : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"}`}><Icon aria-hidden="true" size={16} />{label}</Link>;
  })}</nav>;
}
