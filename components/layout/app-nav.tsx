"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarRange,
  Building2,
  ChevronDown,
  Columns3,
  Flag,
  FolderKanban,
  FolderTree,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  Mail,
  UsersRound,
} from "lucide-react";

const projectTabs = [
  { suffix: "", label: "نمای کلی", icon: LayoutDashboard },
  { suffix: "/tasks", label: "وظایف", icon: ListTodo },
  { suffix: "/gantt", label: "گانت چارت", icon: CalendarRange },
  { suffix: "/sprints", label: "اسپرینت‌ها", icon: CalendarRange },
  { suffix: "/backlog", label: "بک‌لاگ", icon: ListFilter },
  { suffix: "/kanban", label: "برد کانبان", icon: Columns3 },
  { suffix: "/epics", label: "اپیک‌ها", icon: FolderTree },
  { suffix: "/milestones", label: "مایلستون‌ها", icon: Flag },
  { suffix: "/letters", label: "نامه‌نگاری", icon: Mail },
];

export default function AppNav({
  role,
  projects,
  variant = "horizontal",
  onNavigate,
}: {
  role: "ADMIN" | "MANAGER" | "EMPLOYEE" | "CONTROLLER";
  projects: { id: string; name: string }[];
  variant?: "horizontal" | "sidebar";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const sections = [
    {
      label: "فضای کاری",
      links: [
        { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
      ],
    },
    ...(role === "ADMIN"
      ? [
          {
            label: "مدیریت سازمان",
            links: [
              { href: "/companies", label: "شرکت‌ها", icon: Building2 },
              { href: "/users", label: "کاربران", icon: UsersRound },
            ],
          },
        ]
      : []),
  ];
  return (
    <nav
      aria-label="ناوبری اصلی"
      className={
        variant === "sidebar"
          ? "flex flex-col gap-1"
          : "flex min-w-0 flex-wrap justify-center gap-1 sm:justify-start"
      }
    >
      {sections.map((section) => (
        <div key={section.label} className={variant === "sidebar" ? "space-y-1" : "contents"}>
          {variant === "sidebar" && (
            <p className="px-3 pb-1 pt-3 text-[10px] font-extrabold tracking-wide text-[var(--muted)]">
              {section.label}
            </p>
          )}
          {section.links.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === "/projects" && pathname.startsWith("/projects/"));
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors sm:text-sm ${variant === "sidebar" ? "w-full justify-start" : "sm:px-3"} ${active ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/10" : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"}`}
              >
                <Icon aria-hidden="true" size={17} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
      <div className={variant === "sidebar" ? "space-y-1" : "contents"}>
        {variant === "sidebar" && (
          <button
            type="button"
            aria-expanded={projectsOpen}
            aria-controls="sidebar-project-list"
            onClick={() => setProjectsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-3 text-[10px] font-extrabold tracking-wide text-[var(--muted)] hover:bg-slate-50 hover:text-emerald-700"
          >
            پروژه‌ها
            <ChevronDown
              aria-hidden="true"
              size={15}
              className={`transition-transform duration-200 ${projectsOpen ? "rotate-0" : "-rotate-90"}`}
            />
          </button>
        )}
        {(variant !== "sidebar" || projectsOpen) && <>
          <Link
            href="/projects"
            onClick={onNavigate}
            aria-current={pathname === "/projects" ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors sm:text-sm ${variant === "sidebar" ? "w-full justify-start" : "sm:px-3"} ${pathname === "/projects" ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/10" : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"}`}
          >
            <FolderKanban aria-hidden="true" size={17} />
            همه پروژه‌ها
            {variant === "sidebar" && (
              <span className="mr-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {projects.length.toLocaleString("fa-IR")}
              </span>
            )}
          </Link>
        </>}
        {variant === "sidebar" && projectsOpen && (
          <div id="sidebar-project-list" className="mr-4 max-h-60 space-y-0.5 overflow-y-auto border-r border-[var(--border)] py-1 pr-2 [scrollbar-width:thin]">
            {projects.length === 0 ? (
              <p className="px-2 py-1 text-[11px] leading-5 text-[var(--muted)]">پروژه‌ای برای نمایش ندارید.</p>
            ) : (
              projects.map((project) => {
                const href = `/projects/${project.id}`;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                const projectOpen = expandedProjects[project.id] ?? active;
                const projectNavigationId = `project-navigation-${project.id}`;

                return (
                  <div key={project.id}>
                    <div className={`flex min-h-9 items-center rounded-lg text-xs font-semibold transition-colors ${active ? "bg-emerald-50 text-emerald-800" : "text-[var(--muted)] hover:bg-slate-50 hover:text-emerald-700"}`}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={project.name}
                        className="min-w-0 flex-1 truncate px-2 py-2"
                      >
                        {project.name}
                      </Link>
                      <button
                        type="button"
                        aria-label={`${projectOpen ? "بستن" : "باز کردن"} زیرمنوی ${project.name}`}
                        aria-expanded={projectOpen}
                        aria-controls={projectNavigationId}
                        onClick={() => setExpandedProjects((current) => ({
                          ...current,
                          [project.id]: !(current[project.id] ?? active),
                        }))}
                        className="m-1 rounded-md p-1 text-current/70 hover:bg-white/70 hover:text-emerald-700"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          size={14}
                          className={`transition-transform duration-200 ${projectOpen ? "rotate-0" : "-rotate-90"}`}
                        />
                      </button>
                    </div>
                    {projectOpen && (
                      <div id={projectNavigationId} className="mr-3 mt-1 space-y-0.5 border-r border-emerald-200 pr-2">
                        {projectTabs.map(({ suffix, label, icon: Icon }) => {
                          const tabHref = `${href}${suffix}`;
                          const tabActive = pathname === tabHref;

                          return (
                            <Link
                              key={tabHref}
                              href={tabHref}
                              onClick={onNavigate}
                              aria-current={tabActive ? "page" : undefined}
                              className={`flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors ${tabActive ? "bg-emerald-600 text-white" : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"}`}
                            >
                              <Icon aria-hidden="true" size={13} />
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
