
"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
} from "lucide-react";
import { usePathname } from "next/navigation";

type Props = {
  projectId: string;
};

export default function ProjectWorkspaceNav({
  projectId,
}: Props) {
  const pathname = usePathname();

  const base = `/projects/${projectId}`;

  const tabs = [
    {
      href: base,
      label: "نمای کلی",
      description: "مشخصات و پیشرفت",
      icon: LayoutDashboard,
    },
    {
      href: `${base}/tasks`,
      label: "وظایف",
      description: "مدیریت کارها",
      icon: ListTodo,
    },
    {
      href: `${base}/sprints`,
      label: "اسپرینت‌ها",
      description: "برنامه‌ریزی",
      icon: CalendarRange,
    },
  ];

  return (
    <div
      dir="rtl"
      className="relative z-30 mx-auto max-w-6xl px-4 pt-5 sm:px-8"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-emerald-600"
          >
            <ArrowRight size={15} />
            همه پروژه‌ها
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <FolderKanban
              size={16}
              className="text-emerald-600"
            />
            فضای کاری پروژه
          </div>
        </div>

        <nav
          aria-label="بخش‌های پروژه"
          className="grid grid-cols-3 gap-1 p-2 sm:gap-2"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`group flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-3 transition sm:justify-start sm:px-4 ${
                  active
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15"
                    : "text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
                }`}
              >
                <Icon
                  size={19}
                  className="shrink-0"
                />

                <div className="min-w-0 text-right">
                  <span className="block truncate text-xs font-bold sm:text-sm">
                    {tab.label}
                  </span>

                  <span
                    className={`mt-0.5 hidden truncate text-xs sm:block ${
                      active
                        ? "text-emerald-100"
                        : "text-slate-400"
                    }`}
                  >
                    {tab.description}
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
