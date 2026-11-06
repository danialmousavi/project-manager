
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Clock3,
  FolderKanban,
  History,
  LoaderCircle,
  Save,
  Users,
} from "lucide-react";

import UserMultiSelect, {
  type SelectableUser,
} from "@/components/ui/user-multi-select";
import PersianDatePicker from "@/components/ui/persian-date-picker";
import ProjectTasks from "@/components/tasks/project-tasks";

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Status =
  | "DRAFT"
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type Member = {
  role: "MANAGER" | "MEMBER";
  user: {
    id: string;
    name: string;
    role: Role;
  };
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  priority: Priority;
  status: Status;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  members: Member[];
  progressHistory: {
    id: string;
    progress: number;
    note: string | null;
    createdAt: string;
    updatedBy: { name: string };
  }[];
  _count: {
    tasks: number;
    sprints: number;
  };
};

type Props = {
  project: Project;
  canEdit: boolean;
  actorRole: Role;
};

const statusLabels: Record<Status, string> = {
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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100 disabled:text-slate-500";

export default function ProjectDetails({
  project,
  canEdit,
  actorRole,
}: Props) {
  const router = useRouter();
  const isAdmin = actorRole === "ADMIN";

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(
    project.description ?? ""
  );
  const [priority, setPriority] = useState(project.priority);
  const [status, setStatus] = useState(project.status);

  const [startDate, setStartDate] = useState<
    string | null
  >(project.startDate?.slice(0, 10) ?? null);

  const [dueDate, setDueDate] = useState<
    string | null
  >(project.dueDate?.slice(0, 10) ?? null);

  const [managers, setManagers] = useState<
    SelectableUser[]
  >(
    project.members
      .filter((member) => member.role === "MANAGER")
      .map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: "",
      }))
  );

  const [employees, setEmployees] = useState<
    SelectableUser[]
  >(
    project.members
      .filter((member) => member.role === "MEMBER")
      .map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: "",
      }))
  );

  const [progress, setProgress] = useState(
    project.progress
  );
  const [progressNote, setProgressNote] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendRequest(
    url: string,
    method: "PATCH" | "PUT" | "POST",
    body: unknown
  ) {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "عملیات انجام نشد."
      );
    }

    return data;
  }

  async function saveDetails(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canEdit || busy) return;

    if (
      isAdmin &&
      startDate &&
      dueDate &&
      startDate > dueDate
    ) {
      setError(
        "تاریخ پایان قبل از تاریخ شروع است."
      );
      return;
    }

    setBusy("details");
    setError("");
    setNotice("");

    try {
      await sendRequest(
        `/api/v1/projects/${project.id}`,
        "PATCH",
        isAdmin
          ? {
              name,
              description,
              priority,
              status,
              startDate,
              dueDate,
            }
          : { status }
      );

      setNotice("تغییرات پروژه ذخیره شد.");
      router.refresh();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveMembers() {
    if (!canEdit || busy) return;

    setBusy("members");
    setError("");
    setNotice("");

    try {
      await sendRequest(
        `/api/v1/projects/${project.id}/members`,
        "PUT",
        {
          managerIds: managers.map((user) => user.id),
          memberIds: employees.map((user) => user.id),
        }
      );

      setNotice("اعضای پروژه ذخیره شدند.");
      router.refresh();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveProgress() {
    if (!canEdit || busy) return;

    setBusy("progress");
    setError("");
    setNotice("");

    try {
      await sendRequest(
        `/api/v1/projects/${project.id}/progress`,
        "POST",
        {
          progress,
          note: progressNote,
        }
      );

      window.location.reload();
    } catch (error) {
      setError(messageOf(error));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <FolderKanban size={27} />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {project.name}
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                {project.description ||
                  "توضیحی ثبت نشده است."}
              </p>
            </div>
          </div>

          <span className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            {statusLabels[project.status]}
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Info
            label="اعضای پروژه"
            value={`${project.members.length.toLocaleString("fa-IR")} نفر`}
            icon={<Users size={20} />}
          />

          <Info
            label="تسک‌ها"
            value={project._count.tasks.toLocaleString("fa-IR")}
            icon={<FolderKanban size={20} />}
          />

          <Info
            label="اسپرینت‌ها"
            value={project._count.sprints.toLocaleString("fa-IR")}
            icon={<CalendarDays size={20} />}
          />
        </div>
      </header>

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

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              اطلاعات پروژه
            </h2>

            {!isAdmin && (
              <p className="mt-2 text-xs leading-6 text-slate-500">
                نام، توضیحات، اولویت و تاریخ‌های پروژه
                فقط توسط مدیر اصلی تنظیم می‌شوند.
                {canEdit
                  ? " شما می‌توانید وضعیت پروژه را تغییر دهید."
                  : ""}
              </p>
            )}

            <form
              onSubmit={saveDetails}
              className="mt-6 space-y-4"
            >
              <Field label="نام پروژه">
                <input
                  className={inputClass}
                  value={name}
                  disabled={!isAdmin}
                  required
                  minLength={3}
                  maxLength={150}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                />
              </Field>

              <Field label="توضیحات">
                <textarea
                  className={inputClass}
                  rows={3}
                  maxLength={3000}
                  disabled={!isAdmin}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="وضعیت پروژه">
                  <select
                    className={inputClass}
                    value={status}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setStatus(
                        event.target.value as Status
                      )
                    }
                  >
                    {Object.entries(statusLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="اولویت">
                  <select
                    className={inputClass}
                    value={priority}
                    disabled={!isAdmin}
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

                <PersianDatePicker
                  label="تاریخ شروع"
                  value={startDate}
                  onChange={setStartDate}
                  disabled={!isAdmin}
                />

                <PersianDatePicker
                  label="تاریخ پایان"
                  value={dueDate}
                  onChange={setDueDate}
                  disabled={!isAdmin}
                />
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={Boolean(busy)}
                  className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === "details" ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {isAdmin
                    ? "ذخیره اطلاعات"
                    : "ثبت وضعیت پروژه"}
                </button>
              )}
            </form>
          </section>

          <section className="overflow-visible rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Users
                size={20}
                className="text-emerald-600"
              />
              اعضای پروژه
            </h2>

            {canEdit ? (
              <div className="mt-6 space-y-5">
                {isAdmin ? (
                  <UserMultiSelect
                    label="مدیران پروژه"
                    role="MANAGER"
                    projectId={project.id}
                    selected={managers}
                    onChange={setManagers}
                  />
                ) : (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="mb-2 text-xs text-slate-500">
                      مدیران پروژه (فقط نمایشی)
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {managers
                        .map((manager) => manager.name)
                        .join("، ") || "تعیین نشده"}
                    </p>
                  </div>
                )}

                <UserMultiSelect
                  label="کارمندان پروژه"
                  role="EMPLOYEE"
                  projectId={project.id}
                  selected={employees}
                  onChange={setEmployees}
                />

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void saveMembers()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === "members" ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}
                  ذخیره اعضا
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {project.members.map((member) => (
                  <div
                    key={member.user.id}
                    className="flex justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"
                  >
                    <span>{member.user.name}</span>
                    <span className="text-slate-500">
                      {member.role === "MANAGER"
                        ? "مدیر پروژه"
                        : "کارمند"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">
              پیشرفت پروژه
            </h2>

            <p className="mt-7 text-center text-5xl font-extrabold text-emerald-600">
              {progress.toLocaleString("fa-IR")}٪
            </p>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, progress)
                  )}%`,
                }}
              />
            </div>

            {canEdit && (
              <div className="mt-6 space-y-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(event) =>
                    setProgress(
                      Number(event.target.value)
                    )
                  }
                  aria-label="درصد پیشرفت پروژه"
                  className="w-full accent-emerald-600"
                />

                <Field label="توضیحات پیشرفت">
                  <textarea
                    className={inputClass}
                    rows={3}
                    maxLength={1000}
                    value={progressNote}
                    onChange={(event) =>
                      setProgressNote(event.target.value)
                    }
                    placeholder="چه فعالیت‌هایی انجام شده است؟"
                  />
                </Field>

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void saveProgress()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "progress" ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Check size={17} />
                  )}
                  ثبت پیشرفت
                </button>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <History
                size={20}
                className="text-emerald-600"
              />
              تاریخچه پیشرفت
            </h2>

            <div className="mt-5 space-y-4">
              {project.progressHistory.length === 0 && (
                <p className="text-sm text-slate-400">
                  هنوز پیشرفتی ثبت نشده است.
                </p>
              )}

              {project.progressHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-r-2 border-emerald-200 pr-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">
                      {entry.updatedBy.name}
                    </strong>

                    <span className="text-sm font-bold text-emerald-600">
                      {entry.progress.toLocaleString(
                        "fa-IR"
                      )}٪
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    {entry.note || "بدون توضیح"}
                  </p>

                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={13} />
                    {new Date(
                      entry.createdAt
                    ).toLocaleString("fa-IR")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ProjectTasks
        projectId={project.id}
        members={project.members}
        canManage={canEdit}
        actorRole={actorRole}
      />
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex size-11 items-center justify-center rounded-xl bg-white text-emerald-600">
        {icon}
      </div>

      <div>
        <p className="text-xs text-slate-500">
          {label}
        </p>

        <p className="mt-1 text-xl font-bold">
          {value}
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}
