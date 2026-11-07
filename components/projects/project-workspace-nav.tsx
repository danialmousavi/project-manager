
"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Columns3,
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
      href: `${base}/tasks`,
      label: "وظایف",
      icon: ListTodo,
    },
    {
      href: `${base}/sprints`,
      label: "اسپرینت‌ها",
      icon: CalendarRange,
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
      className="relative z-30 mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-8"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h1 className="flex min-w-0 items-center gap-2 text-base font-extrabold text-[var(--foreground)] sm:text-lg">
            <FolderKanban
              size={19}
              className="shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span className="truncate" title={projectName}>{projectName}</span>
          </h1>
          <Link href="/projects" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-emerald-700"><ArrowRight aria-hidden="true" size={15} /> همه پروژه‌ها</Link>
        </div>

        <nav
          aria-label="بخش‌های پروژه"
          className="grid grid-cols-2 gap-1 p-1.5 sm:grid-cols-4"
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
                className={`group flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-xs font-bold transition sm:text-sm ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <Icon
                  size={17}
                  aria-hidden="true"
                  className="shrink-0"
                />

                <div className="min-w-0">
                  <span className="block leading-5">
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
