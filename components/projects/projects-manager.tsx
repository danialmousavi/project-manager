
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  FolderKanban,
  LoaderCircle,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import UserMultiSelect, {
  type SelectableUser,
} from "@/components/ui/user-multi-select";
import PersianDatePicker from "@/components/ui/persian-date-picker";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type ProjectStatus =
  | "DRAFT"
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  createdAt: string;
  members: {
    role: "MANAGER" | "MEMBER";
    user: {
      id: string;
      name: string;
    };
  }[];
};

type Props = {
  initialProjects: Project[];
  canCreate: boolean;
};

const statusLabels: Record<ProjectStatus, string> = {
  DRAFT: "پیش‌نویس",
  PLANNED: "برنامه‌ریزی‌شده",
  ACTIVE: "در حال اجرا",
  ON_HOLD: "متوقف‌شده",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

const priorityLabels: Record<Priority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const priorityColors: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-rose-50 text-rose-700",
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base transition focus-visible:border-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700 sm:text-sm";

export default function ProjectsManager({
  initialProjects,
  canCreate,
}: Props) {
  const [projects, setProjects] = useState(initialProjects);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<Priority>("MEDIUM");

  const [managers, setManagers] = useState<
    SelectableUser[]
  >([]);
  const [employees, setEmployees] = useState<
    SelectableUser[]
  >([]);

  const [startDate, setStartDate] = useState<
    string | null
  >(null);
  const [dueDate, setDueDate] = useState<
    string | null
  >(null);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLocaleLowerCase("fa-IR").includes(search.trim().toLocaleLowerCase("fa-IR")) &&
      (statusFilter === "ALL" || project.status === statusFilter)
  );

  function resetForm() {
    setName("");
    setDescription("");
    setPriority("MEDIUM");
    setManagers([]);
    setEmployees([]);
    setStartDate(null);
    setDueDate(null);
  }

  async function createProject(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canCreate || saving) return;

    if (managers.length === 0) {
      setError("حداقل یک مدیر پروژه انتخاب کنید.");
      return;
    }

    if (
      startDate &&
      dueDate &&
      startDate > dueDate
    ) {
      setError(
        "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          priority,
          managerIds: managers.map((user) => user.id),
          memberIds: employees.map((user) => user.id),
          startDate,
          dueDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ساخت پروژه ناموفق بود."
        );
      }

      const newProject: Project = {
        id: data.project.id,
        name: data.project.name,
        description: description.trim() || null,
        priority,
        status: "PLANNED",
        progress: 0,
        createdAt: new Date().toISOString(),
        members: [
          ...managers.map((user) => ({
            role: "MANAGER" as const,
            user: {
              id: user.id,
              name: user.name,
            },
          })),
          ...employees.map((user) => ({
            role: "MEMBER" as const,
            user: {
              id: user.id,
              name: user.name,
            },
          })),
        ],
      };

      setProjects((previous) => [
        newProject,
        ...previous,
      ]);

      resetForm();
      setShowForm(false);
      setNotice("پروژه جدید با موفقیت ایجاد شد.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "خطا در ایجاد پروژه."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="آمار پروژه‌ها" className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat
          label="همه پروژه‌ها"
          value={projects.length}
          icon={<FolderKanban size={18} aria-hidden="true" />}
        />

        <Stat
          label="در حال اجرا"
          value={
            projects.filter(
              (project) => project.status === "ACTIVE"
            ).length
          }
          icon={<Users size={18} aria-hidden="true" />}
        />

        <Stat
          label="تکمیل‌شده"
          value={
            projects.filter(
              (project) => project.status === "COMPLETED"
            ).length
          }
          icon={<CheckCircle2 size={18} aria-hidden="true" />}
        />
      </div>

      <section aria-labelledby="projects-list-title" className="rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <h2 id="projects-list-title" className="text-base font-bold text-slate-900">
              پروژه‌ها
            </h2>
            <p aria-live="polite" className="mt-0.5 text-xs text-[var(--muted)]">
              {filteredProjects.length.toLocaleString("fa-IR")} از {projects.length.toLocaleString("fa-IR")} پروژه
            </p>
          </div>

          {canCreate && (
            <button
              type="button"
              aria-expanded={showForm}
              aria-controls="project-create-form"
              onClick={() => {
                setShowForm((previous) => !previous);
                setError("");
                setNotice("");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {showForm ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Plus size={18} aria-hidden="true" />
              )}
              {showForm
                ? "بستن فرم"
                : "پروژه جدید"}
            </button>
          )}
        </div>

        {showForm && canCreate && (
          <form
            id="project-create-form"
            onSubmit={createProject}
            className="relative z-20 space-y-4 border-b border-[var(--border)] bg-emerald-50/30 p-4 sm:p-5"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ایجاد پروژه جدید
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                مشخصات، زمان‌بندی و اعضای پروژه را
                انتخاب کنید.
              </p>
            </div>

            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام پروژه">
                <input
                  autoFocus
                  className={inputClass}
                  value={name}
                  required
                  minLength={3}
                  maxLength={150}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="مثلاً توسعه سامانه فروش"
                />
              </Field>

              <Field label="اولویت">
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value as Priority
                    )
                  }
                >
                  {Object.entries(priorityLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="توضیحات">
                  <textarea
                    className={inputClass}
                    rows={2}
                    maxLength={3000}
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder="توضیح کوتاه درباره پروژه..."
                  />
                </Field>
              </div>

              <PersianDatePicker
                label="تاریخ شروع پروژه"
                value={startDate}
                onChange={setStartDate}
              />

              <PersianDatePicker
                label="تاریخ پایان پروژه"
                value={dueDate}
                onChange={setDueDate}
              />
            </div>

            <div className="grid items-start gap-3 md:grid-cols-2">
              <UserMultiSelect
                label="مدیران پروژه"
                role="MANAGER"
                selected={managers}
                onChange={setManagers}
                placeholder="انتخاب مدیران پروژه..."
              />

              <UserMultiSelect
                label="کارمندان پروژه"
                role="EMPLOYEE"
                selected={employees}
                onChange={setEmployees}
                placeholder="انتخاب کارمندان پروژه..."
              />
            </div>

            <p className="text-xs leading-5 text-[var(--muted)]">
              حداقل یک مدیر پروژه الزامی است. جست‌وجوی
              کاربران از سمت سرور انجام می‌شود.
            </p>

            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={17} />
                )}
                {saving
                  ? "در حال ساخت..."
                  : "ثبت پروژه"}
              </button>
            </div>
          </form>
        )}

        {notice && (
          <div className="px-4 pt-3 sm:px-5">
            {notice && (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                {notice}
              </p>
            )}
          </div>
        )}

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="project-search" className="mb-1 block text-xs font-semibold text-slate-700">جست‌وجوی پروژه</label>
              <div className="relative">
                <Search aria-hidden="true" size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input id="project-search" type="search" className={`${inputClass} pr-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="نام پروژه..." />
              </div>
            </div>
            <div className="sm:w-48">
              <label htmlFor="project-status-filter" className="mb-1 block text-xs font-semibold text-slate-700">وضعیت</label>
              <select id="project-status-filter" className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProjectStatus | "ALL")}>
                <option value="ALL">همه وضعیت‌ها</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
              <FolderKanban
                size={26}
                aria-hidden="true"
                className="mx-auto text-[var(--muted)]"
              />
              <p className="mt-2 text-sm text-[var(--muted)]">
                {search || statusFilter !== "ALL"
                  ? "پروژه‌ای با این فیلترها پیدا نشد."
                  : "هنوز پروژه‌ای ثبت نشده است."}
              </p>
              {(search || statusFilter !== "ALL") && <button type="button" onClick={() => { setSearch(""); setStatusFilter("ALL"); }} className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">پاک کردن فیلترها</button>}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredProjects.map((project) => {
                const managersOfProject =
                  project.members.filter(
                    (member) =>
                      member.role === "MANAGER"
                  );

                return (
                  <article
                    key={project.id}
                    className="relative min-w-0 rounded-xl border border-[var(--border)] p-3 transition-colors hover:border-[var(--primary-border)] hover:bg-emerald-50/30 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words text-base font-bold text-slate-900">
                        <Link href={`/projects/${project.id}`} className="outline-none after:absolute after:inset-0">{project.name}</Link>
                      </h3>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${priorityColors[project.priority]}`}>اولویت {priorityLabels[project.priority]}</span>
                    </div>

                    {project.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{project.description}</p>}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{statusLabels[project.status]}</span>
                      <span className="inline-flex items-center gap-1"><Users aria-hidden="true" size={14} />{project.members.length.toLocaleString("fa-IR")} عضو</span>
                      <span className="min-w-0 break-words">مدیر: {managersOfProject.map((member) => member.user.name).join("، ") || "تعیین نشده"}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="shrink-0 text-xs text-[var(--muted)]">پیشرفت</span>
                      <div role="progressbar" aria-label={`پیشرفت پروژه ${project.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress} className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-emerald-100">
                        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }} />
                      </div>
                      <strong className="shrink-0 text-xs text-emerald-700 tabular-nums">{project.progress.toLocaleString("fa-IR")}٪</strong>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
                      <span>ایجاد: {new Date(project.createdAt).toLocaleDateString("fa-IR")}</span>
                      <span aria-hidden="true" className="inline-flex items-center gap-1 font-semibold text-emerald-700">مشاهده پروژه <ChevronLeft size={15} /></span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 sm:gap-3 sm:px-4">
      <div className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 sm:flex">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs leading-5 text-[var(--muted)]">
          {label}
        </p>
        <p className="text-lg font-bold text-slate-900 tabular-nums sm:text-xl">
          {value.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
