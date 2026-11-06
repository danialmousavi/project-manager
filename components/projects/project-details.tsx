
"use client";

import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
  LoaderCircle,
  Save,
  Users,
} from "lucide-react";

import UserMultiSelect, {
  type SelectableUser,
} from "@/components/ui/user-multi-select";

import PersianDatePicker from "@/components/ui/persian-date-picker";

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Status =
  | "DRAFT"
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

type Member = {
  role: "MANAGER" | "MEMBER";
  user: {
    id: string;
    name: string;
    role: Role;
  };
};

type TaskStats = Record<TaskStatus, number>;

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
  _count: {
    tasks: number;
    sprints: number;
  };
};

type Props = {
  project: Project;
  taskStats: TaskStats;
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

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در حال بررسی",
  DONE: "انجام‌شده",
};

const taskStatusColors: Record<TaskStatus, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-600",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-white px-4 py-3 text-sm text-slate-800 " +
  "outline-none transition " +
  "focus:border-emerald-500 " +
  "focus:ring-4 focus:ring-emerald-500/10 " +
  "disabled:bg-slate-100 disabled:text-slate-500";

export default function ProjectDetails({
  project,
  taskStats,
  canEdit,
  actorRole,
}: Props) {
  const router = useRouter();

  const isAdmin = actorRole === "ADMIN";

  const [name, setName] = useState(project.name);

  const [description, setDescription] = useState(
    project.description ?? ""
  );

  const [priority, setPriority] = useState(
    project.priority
  );

  const [status, setStatus] = useState(
    project.status
  );

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

  const [busy, setBusy] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const totalTasks =
    taskStats.TODO +
    taskStats.IN_PROGRESS +
    taskStats.IN_REVIEW +
    taskStats.DONE;

  const progress = Math.max(
    0,
    Math.min(100, project.progress)
  );

  async function sendRequest(
    url: string,
    method: "PATCH" | "PUT",
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
          : {
              status,
            }
      );

      setNotice("تغییرات پروژه ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(messageOf(err));
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
          managerIds: managers.map(
            (user) => user.id
          ),
          memberIds: employees.map(
            (user) => user.id
          ),
        }
      );

      setNotice("اعضای پروژه ذخیره شدند.");
      router.refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
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
            value={project._count.tasks.toLocaleString(
              "fa-IR"
            )}
            icon={<ListTodo size={20} />}
          />

          <Info
            label="اسپرینت‌ها"
            value={project._count.sprints.toLocaleString(
              "fa-IR"
            )}
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
                نام، توضیحات، اولویت و تاریخ‌های
                پروژه فقط توسط مدیر اصلی تنظیم
                می‌شوند.
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
                    setDescription(
                      event.target.value
                    )
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
                    {Object.entries(
                      statusLabels
                    ).map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
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
                    {Object.entries(
                      priorityLabels
                    ).map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ))}
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
                        .join("، ") ||
                        "تعیین نشده"}
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
                {project.members.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    هنوز عضوی ثبت نشده است.
                  </p>
                ) : (
                  project.members.map((member) => (
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
                  ))
                )}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Activity
                  size={20}
                  className="text-emerald-600"
                />
                پیشرفت پروژه
              </h2>

              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                محاسبه خودکار
              </span>
            </div>

            <p className="mt-7 text-center text-5xl font-extrabold text-emerald-600">
              {progress.toLocaleString("fa-IR")}٪
            </p>

            <div
              className="mt-5 h-3 overflow-hidden rounded-full bg-emerald-100"
              role="progressbar"
              aria-label="پیشرفت خودکار پروژه"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p className="mt-4 text-center text-xs leading-6 text-slate-500">
              محاسبه‌شده از وضعیت تمام تسک‌های پروژه
            </p>

            {totalTasks === 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-xs leading-6 text-amber-800">
                هنوز تسکی در پروژه وجود ندارد؛
                پیشرفت صفر درصد است.
              </p>
            )}

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
              {(Object.keys(
                taskStatusLabels
              ) as TaskStatus[]).map(
                (taskStatus) => (
                  <div
                    key={taskStatus}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2.5 rounded-full ${taskStatusColors[taskStatus]}`}
                      />

                      <span className="text-xs text-slate-600">
                        {taskStatusLabels[taskStatus]}
                      </span>
                    </div>

                    <strong className="text-sm text-slate-800">
                      {taskStats[
                        taskStatus
                      ].toLocaleString("fa-IR")}
                    </strong>
                  </div>
                )
              )}
            </div>

            <div className="mt-5 rounded-xl bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-emerald-800">
                <span>مجموع تسک‌ها</span>
                <strong>
                  {totalTasks.toLocaleString("fa-IR")}
                </strong>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <span>تسک‌های تکمیل‌شده</span>
                <strong>
                  {taskStats.DONE.toLocaleString(
                    "fa-IR"
                  )}
                </strong>
              </div>
            </div>

            <Link
              href={`/projects/${project.id}/tasks`}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <ListTodo size={17} />
              مدیریت وظایف پروژه
              <ArrowLeft size={15} />
            </Link>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <CheckCircle2
                size={20}
                className="text-emerald-600"
              />
              نحوه محاسبه پیشرفت
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              پیشرفت براساس وضعیت واقعی تسک‌ها
              محاسبه می‌شود. ایجاد، حذف یا تغییر
              وضعیت تسک‌ها روی درصد پروژه اثر
              می‌گذارد.
            </p>

            <div className="mt-5 space-y-3">
              <WeightRow
                label="برای انجام"
                weight="۰٪"
                colorClass="bg-slate-400"
              />

              <WeightRow
                label="در حال انجام"
                weight="۵۰٪"
                colorClass="bg-sky-500"
              />

              <WeightRow
                label="در حال بررسی"
                weight="۹۰٪"
                colorClass="bg-amber-500"
              />

              <WeightRow
                label="انجام‌شده"
                weight="۱۰۰٪"
                colorClass="bg-emerald-600"
              />
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-4">
              <Clock3
                size={16}
                className="mt-0.5 shrink-0 text-emerald-600"
              />

              <p className="text-xs leading-6 text-slate-500">
                تغییرات بعد از بازکردن مجدد صفحه
                یا تازه‌سازی آن در این کارت
                منعکس می‌شوند.
              </p>
            </div>
          </section>
        </div>
      </div>
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
  icon: ReactNode;
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
  children: ReactNode;
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

function WeightRow({
  label,
  weight,
  colorClass,
}: {
  label: string;
  weight: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`size-2.5 rounded-full ${colorClass}`}
        />

        <span className="text-xs text-slate-600">
          {label}
        </span>
      </div>

      <strong className="text-xs text-slate-800">
        {weight}
      </strong>
    </div>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}
