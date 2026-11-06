
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

const statuses: Record<ProjectStatus, string> = {
  DRAFT: "پیش‌نویس",
  PLANNED: "برنامه‌ریزی‌شده",
  ACTIVE: "در حال اجرا",
  ON_HOLD: "متوقف‌شده",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

const priorities: Record<Priority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const priorityClasses: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-rose-50 text-rose-700",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

export default function ProjectsManager({
  initialProjects,
  canCreate,
}: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<Priority>("MEDIUM");

  const [managers, setManagers] = useState<SelectableUser[]>([]);
  const [employees, setEmployees] = useState<SelectableUser[]>([]);

  const filteredProjects = projects.filter((project) =>
    project.name
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  );

  async function createProject(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving || !canCreate) return;

    if (managers.length === 0) {
      setError("حداقل یک مدیر پروژه انتخاب کنید.");
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ایجاد پروژه ناموفق بود"
        );
      }

      const newProject: Project = {
        id: data.project.id,
        name: data.project.name,
        description: description.trim() || null,
        status: "PLANNED",
        priority,
        progress: 0,
        createdAt: new Date().toISOString(),
        members: [
          ...managers.map((user) => ({
            role: "MANAGER" as const,
            user: { id: user.id, name: user.name },
          })),
          ...employees.map((user) => ({
            role: "MEMBER" as const,
            user: { id: user.id, name: user.name },
          })),
        ],
      };

      setProjects((previous) => [
        newProject,
        ...previous,
      ]);

      setName("");
      setDescription("");
      setPriority("MEDIUM");
      setManagers([]);
      setEmployees([]);
      setShowForm(false);

      setNotice("پروژه جدید با موفقیت ساخته شد.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ایجاد پروژه"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="کل پروژه‌ها"
          value={projects.length}
          icon={<FolderKanban size={20} />}
        />
        <Stat
          label="در حال اجرا"
          value={
            projects.filter((p) => p.status === "ACTIVE").length
          }
          icon={<Users size={20} />}
        />
        <Stat
          label="تکمیل‌شده"
          value={
            projects.filter((p) => p.status === "COMPLETED")
              .length
          }
          icon={<CheckCircle2 size={20} />}
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              فهرست پروژه‌ها
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              {projects.length.toLocaleString("fa-IR")} پروژه
              ثبت شده
            </p>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setShowForm((previous) => !previous);
                setError("");
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {showForm ? <X size={17} /> : <Plus size={17} />}
              {showForm ? "بستن فرم" : "پروژه جدید"}
            </button>
          )}
        </div>

        {showForm && canCreate && (
          <form
            onSubmit={createProject}
            className="space-y-6 border-b border-indigo-100 bg-indigo-50/30 p-6"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                ایجاد پروژه جدید
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                ابتدا مشخصات پروژه و سپس اعضای آن را
                انتخاب کنید.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  نام پروژه
                </span>
                <input
                  className={inputClass}
                  required
                  minLength={3}
                  maxLength={150}
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="مثلاً توسعه سامانه فروش"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  اولویت
                </span>
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as Priority)
                  }
                >
                  {Object.entries(priorities).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  توضیحات
                </span>
                <textarea
                  className={inputClass}
                  rows={3}
                  maxLength={3000}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="توضیحات پروژه..."
                />
              </label>
            </div>

            <div className="grid items-start gap-6 md:grid-cols-2">
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

            <p className="text-xs leading-6 text-slate-500">
              حداقل یک مدیر الزامی است. برای پیدا کردن
              افراد، نام یا ایمیل آن‌ها را جست‌وجو کنید.
            </p>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Plus size={17} />
                )}
                {saving ? "در حال ساخت..." : "ثبت پروژه"}
              </button>
            </div>
          </form>
        )}

        {(error || notice) && (
          <div className="space-y-2 px-6 pt-5">
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
              >
                {notice}
              </p>
            )}
          </div>
        )}

        <div className="p-6">
          <div className="relative mb-6">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${inputClass} pr-11`}
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="جست‌وجوی پروژه..."
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-16 text-center">
              <FolderKanban
                size={36}
                className="mx-auto text-slate-300"
              />
              <p className="mt-4 text-sm text-slate-500">
                {search
                  ? "پروژه‌ای با این نام پیدا نشد."
                  : "هنوز پروژه‌ای وجود ندارد."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredProjects.map((project) => {
                const managersOfProject =
                  project.members.filter(
                    (member) => member.role === "MANAGER"
                  );

                return (
                  <article
                    key={project.id}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <FolderKanban size={22} />
                      </div>

                      <span
                        className={`rounded-lg px-3 py-1.5 text-xs ${priorityClasses[project.priority]}`}
                      >
                        اولویت {priorities[project.priority]}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      {project.name}
                    </h3>

                    <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-7 text-slate-500">
                      {project.description ||
                        "توضیحی ثبت نشده است."}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">
                        {statuses[project.status]}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users size={14} />
                        {project.members.length.toLocaleString(
                          "fa-IR"
                        )}{" "}
                        عضو
                      </span>
                    </div>

                    <p className="mt-4 text-xs leading-6 text-slate-500">
                      مدیران:{" "}
                      {managersOfProject
                        .map((member) => member.user.name)
                        .join("، ") || "تعیین نشده"}
                    </p>

                    <div className="mt-6">
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-slate-500">
                          پیشرفت پروژه
                        </span>
                        <strong className="text-indigo-600">
                          {project.progress.toLocaleString(
                            "fa-IR"
                          )}
                          ٪
                        </strong>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, project.progress)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-xs text-slate-400">
                        {new Date(
                          project.createdAt
                        ).toLocaleDateString("fa-IR")}
                      </span>

                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        مشاهده جزئیات
                        <ChevronLeft size={16} />
                      </Link>
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
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {value.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}
