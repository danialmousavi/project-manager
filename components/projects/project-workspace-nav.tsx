
"use client";

import Link from "next/link";
import {
  ArrowRight,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Columns3,
  ListFilter,
} from "lucide-react";

import { usePathname } from "next/navigation";

type Props = {
  projectId: string;
  projectName: string;
};

export default function ProjectWorkspaceNav({
  projectId,
  projectName,
}: Props) {
  const pathname = usePathname();

  const base = `/projects/${projectId}`;

  const tabs = [
    {
      href: base,
      label: "نمای کلی",
      icon: LayoutDashboard,
    },
    {
      href: `${base}/sprints`,
      label: "وظایف",
      icon: ListTodo,
    },
    {
      href: `${base}/backlog`,
      label: "بک‌لاگ",
      icon: ListFilter,
    },
    {
      href: `${base}/kanban`,
      label: "برد کانبان",
      icon: Columns3,
    },
  ];

  return (
    <div
      dir="rtl"
      className="relative z-30 mx-auto max-w-[1440px] px-4 pt-3 sm:px-6 lg:px-8"
    >
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2 sm:px-4">
          <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-extrabold text-[var(--foreground)]">
            <FolderKanban
              size={16}
              className="shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span className="truncate" title={projectName}>{projectName}</span>
          </h1>
          <Link href="/projects" className="inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-[var(--muted)] hover:text-emerald-700"><ArrowRight aria-hidden="true" size={13} /> همه پروژه‌ها</Link>
        </div>

        <nav
          aria-label="بخش‌های پروژه"
          className="grid grid-cols-2 gap-0.5 p-1 sm:grid-cols-4"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                title={tab.label}
                className={`group flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-center text-[11px] font-bold transition sm:text-xs ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <Icon
                  size={15}
                  aria-hidden="true"
                  className="shrink-0"
                />

                <div className="min-w-0">
                  <span className="block leading-4">
                    {tab.label}
                  </span>

                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
