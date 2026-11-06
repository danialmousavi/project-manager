
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
import ProjectTasks from "@/components/tasks/project-tasks";
import { isoToJalali, jalaliToIso } from "@/lib/jalali";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Status =
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
  status: Status;
  priority: Priority;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;

  members: {
    role: "MANAGER" | "MEMBER";
    user: {
      id: string;
      name: string;
      role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    };
  }[];

  progressHistory: {
    id: string;
    progress: number;
    note: string | null;
    createdAt: string;
    updatedBy: {
      name: string;
    };
  }[];

  _count: {
    tasks: number;
    sprints: number;
  };
};

type Props = {
  project: Project;
  canEdit: boolean;
};

const statuses: Record<Status, string> = {
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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50";

export default function ProjectDetails({
  project,
  canEdit,
}: Props) {
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(
    project.description ?? ""
  );
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(
    project.priority
  );
  const [startDate, setStartDate] = useState(
    isoToJalali(project.startDate)
  );
  const [dueDate, setDueDate] = useState(
    isoToJalali(project.dueDate)
  );

  const [managers, setManagers] = useState<SelectableUser[]>(
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
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendRequest(
    endpoint: string,
    method: "PATCH" | "PUT" | "POST",
    body: unknown
  ) {
    const response = await fetch(endpoint, {
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
        data.message || "عملیات ناموفق بود"
      );
    }

    return data;
  }

  async function saveDetails(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canEdit || busy) return;

    const convertedStart = startDate
      ? jalaliToIso(startDate)
      : null;

    const convertedDue = dueDate
      ? jalaliToIso(dueDate)
      : null;

    if (startDate && !convertedStart) {
      setError("تاریخ شروع شمسی معتبر نیست.");
      return;
    }

    if (dueDate && !convertedDue) {
      setError("تاریخ پایان شمسی معتبر نیست.");
      return;
    }

    if (
      convertedStart &&
      convertedDue &&
      convertedStart > convertedDue
    ) {
      setError(
        "تاریخ پایان نمی‌تواند قبل از شروع باشد."
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
        {
          name,
          description,
          status,
          priority,
          startDate: convertedStart,
          dueDate: convertedDue,
        }
      );

      setNotice("اطلاعات پروژه ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ذخیره اطلاعات پروژه"
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveMembers() {
    if (!canEdit || busy) return;

    if (managers.length === 0) {
      setError("حداقل یک مدیر پروژه انتخاب کنید.");
      return;
    }

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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ذخیره اعضای پروژه"
      );
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
          note,
        }
      );

      setNote("");
      setNotice("پیشرفت پروژه ثبت شد.");

      // Reload the progress history after saving.
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ثبت پیشرفت"
      );
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <FolderKanban size={27} />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {project.name}
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                {project.description ||
                  "توضیحاتی ثبت نشده است."}
              </p>
            </div>
          </div>

          <span className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">
            {statuses[project.status]}
          </span>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <InfoCard
            icon={<Users size={20} />}
            label="اعضای پروژه"
            value={`${project.members.length.toLocaleString("fa-IR")} نفر`}
          />
          <InfoCard
            icon={<FolderKanban size={20} />}
            label="وظایف"
            value={project._count.tasks.toLocaleString("fa-IR")}
          />
          <InfoCard
            icon={<CalendarDays size={20} />}
            label="اسپرینت‌ها"
            value={project._count.sprints.toLocaleString("fa-IR")}
          />
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700"
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
            <p className="mt-2 text-xs text-slate-500">
              مشخصات اصلی و تاریخ‌های شمسی پروژه
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={saveDetails}
            >
              <Field label="نام پروژه">
                <input
                  className={inputClass}
                  value={name}
                  required
                  minLength={3}
                  maxLength={150}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                />
              </Field>

              <Field label="توضیحات">
                <textarea
                  className={inputClass}
                  rows={4}
                  maxLength={3000}
                  disabled={!canEdit}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="وضعیت">
                  <select
                    className={inputClass}
                    disabled={!canEdit}
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as Status)
                    }
                  >
                    {Object.entries(statuses).map(
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
                    disabled={!canEdit}
                    value={priority}
                    onChange={(event) =>
                      setPriority(
                        event.target.value as Priority
                      )
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
                </Field>

                <Field label="تاریخ شروع شمسی">
                  <input
                    className={inputClass}
                    dir="ltr"
                    disabled={!canEdit}
                    placeholder="1405/08/15"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(event.target.value)
                    }
                  />
                </Field>

                <Field label="تاریخ پایان شمسی">
                  <input
                    className={inputClass}
                    dir="ltr"
                    disabled={!canEdit}
                    placeholder="1405/09/15"
                    value={dueDate}
                    onChange={(event) =>
                      setDueDate(event.target.value)
                    }
                  />
                </Field>
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={Boolean(busy)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "details" ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}
                  ذخیره اطلاعات
                </button>
              )}
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Users
                size={21}
                className="text-indigo-600"
              />
              <h2 className="text-lg font-bold text-slate-900">
                اعضای پروژه
              </h2>
            </div>

            <p className="mt-2 text-xs leading-6 text-slate-500">
              مدیران و کارمندان را با جست‌وجوی نام یا
              ایمیل انتخاب کنید.
            </p>

            {!canEdit ? (
              <div className="mt-5 space-y-2">
                {project.members.map((member) => (
                  <div
                    key={member.user.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {member.user.name}
                    </span>

                    <span className="text-xs text-slate-500">
                      {member.role === "MANAGER"
                        ? "مدیر پروژه"
                        : "کارمند"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-6 grid items-start gap-6 sm:grid-cols-2">
                  <UserMultiSelect
                    label="مدیران پروژه"
                    role="MANAGER"
                    projectId={project.id}
                    selected={managers}
                    onChange={setManagers}
                    placeholder="انتخاب مدیران..."
                  />

                  <UserMultiSelect
                    label="کارمندان پروژه"
                    role="EMPLOYEE"
                    projectId={project.id}
                    selected={employees}
                    onChange={setEmployees}
                    placeholder="انتخاب کارمندان..."
                  />
                </div>

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={saveMembers}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
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
              </>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              پیشرفت پروژه
            </h2>

            <div className="mt-7 text-center">
              <p className="text-5xl font-extrabold text-indigo-600">
                {progress.toLocaleString("fa-IR")}٪
              </p>
              <p className="mt-2 text-xs text-slate-500">
                میزان پیشرفت ثبت‌شده
              </p>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, progress)
                  )}%`,
                }}
              />
            </div>

            {canEdit && (
              <div className="mt-6 space-y-5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={progress}
                  onChange={(event) =>
                    setProgress(Number(event.target.value))
                  }
                  className="w-full accent-indigo-600"
                  aria-label="درصد پیشرفت پروژه"
                />

                <Field label="توضیحات پیشرفت">
                  <textarea
                    className={inputClass}
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(event) =>
                      setNote(event.target.value)
                    }
                    placeholder="چه کارهایی انجام شده؟"
                  />
                </Field>

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={saveProgress}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
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
            <div className="flex items-center gap-2">
              <History
                size={20}
                className="text-indigo-600"
              />
              <h2 className="text-lg font-bold text-slate-900">
                تاریخچه پیشرفت
              </h2>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              ۳۰ ثبت آخر
            </p>

            <div className="mt-6 space-y-4">
              {project.progressHistory.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  هنوز پیشرفتی ثبت نشده است.
                </p>
              )}

              {project.progressHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-r-2 border-indigo-200 pr-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-slate-800">
                      {entry.updatedBy.name}
                    </strong>

                    <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                      {entry.progress.toLocaleString("fa-IR")}٪
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    {entry.note || "بدون توضیح"}
                  </p>

                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={13} />
                    {new Date(
                      entry.createdAt
                    ).toLocaleString("fa-IR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Project tasks */}
      <div className="mt-6">
        <ProjectTasks
          projectId={project.id}
          members={project.members}
          canManage={canEdit}
        />
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">
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
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
