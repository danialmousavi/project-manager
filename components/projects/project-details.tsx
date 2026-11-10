
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
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileDown,
  ListTodo,
  LoaderCircle,
  PieChart,
  Save,
  TrendingUp,
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

const taskStatusChartColors: Record<TaskStatus, string> = {
  TODO: "#94a3b8",
  IN_PROGRESS: "#0ea5e9",
  IN_REVIEW: "#f59e0b",
  DONE: "#16a34a",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "min-h-11 bg-white px-3 py-2 text-sm text-slate-800 " +
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

  function printProjectReport() {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("مرورگر اجازه باز کردن پنجره گزارش را نداد. لطفاً پاپ‌آپ‌ها را فعال کنید.");
      return;
    }

    const taskRows = (Object.keys(taskStatusLabels) as TaskStatus[])
      .map(
        (taskStatus) => `
          <tr class="task-row">
            <td><span class="status-dot" style="background: ${taskStatusChartColors[taskStatus]}"></span>${escapeHtml(taskStatusLabels[taskStatus])}</td>
            <td class="number">${taskStats[taskStatus].toLocaleString("fa-IR")}</td>
          </tr>`
      )
      .join("");

    const memberRows = project.members.length
      ? project.members
          .map(
            (member) => `
              <tr>
                <td>${escapeHtml(member.user.name)}</td>
                <td><span class="role">${member.role === "MANAGER" ? "مدیر پروژه" : "کارمند"}</span></td>
              </tr>`
          )
          .join("")
      : '<tr><td colspan="2">عضوی ثبت نشده است.</td></tr>';

    const report = `<!doctype html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>گزارش پروژه ${escapeHtml(project.name)}</title>
          <style>
            @page { size: A4; margin: 13mm; }
            * { box-sizing: border-box; }
            body { margin: 0; direction: rtl; background: #f8fafc; color: #172033; font-family: Tahoma, Arial, sans-serif; font-size: 12px; line-height: 1.75; }
            .report { max-width: 794px; margin: 0 auto; background: #fff; }
            .hero { position: relative; overflow: hidden; padding: 27px 30px 24px; color: #fff; background: linear-gradient(125deg, #064e3b, #047857 62%, #0f9f76); border-radius: 16px; }
            .hero::after { content: ""; position: absolute; width: 160px; height: 160px; left: -55px; top: -62px; border: 28px solid rgba(255,255,255,.12); border-radius: 50%; }
            .eyebrow { position: relative; z-index: 1; margin: 0 0 5px; color: #d1fae5; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
            h1 { position: relative; z-index: 1; margin: 0; font-size: 23px; line-height: 1.45; }
            .meta { position: relative; z-index: 1; margin: 7px 0 0; color: #ecfdf5; font-size: 10px; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 17px 0; }
            .stat { min-height: 72px; padding: 12px 14px; border: 1px solid #d1fae5; border-radius: 11px; background: #f0fdf4; }
            .stat-label { display: block; color: #477565; font-size: 10px; }
            .stat-value { display: block; margin-top: 2px; color: #065f46; font-size: 19px; font-weight: 800; line-height: 1.4; }
            .content { padding: 0 4px; }
            .section { margin-top: 20px; break-inside: avoid; }
            h2 { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; color: #064e3b; font-size: 14px; }
            h2::before { content: ""; width: 4px; height: 18px; border-radius: 99px; background: #10b981; }
            .description { margin: 0 0 11px; padding: 11px 13px; border-right: 3px solid #6ee7b7; border-radius: 8px; background: #f8fafc; color: #475569; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 9px; }
            th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: top; }
            tr:last-child td { border-bottom: 0; }
            th { width: 28%; color: #475569; background: #f8fafc; font-weight: 700; }
            .task-table th { width: auto; color: #334155; background: #ecfdf5; }
            .task-row:nth-child(even) td, .member-row:nth-child(even) td { background: #fcfdfd; }
            .number { font-weight: 800; color: #065f46; }
            .status-dot { display: inline-block; width: 8px; height: 8px; margin-left: 7px; border-radius: 50%; vertical-align: middle; }
            .role { display: inline-block; padding: 1px 7px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 700; }
            .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; text-align: center; }
            @media print { body { background: #fff; } .report { max-width: none; } .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .stats, .stat, th, .task-row:nth-child(even) td, .role { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main class="report">
            <header class="hero">
              <p class="eyebrow">گزارش وضعیت پروژه</p>
              <h1>${escapeHtml(project.name)}</h1>
              <p class="meta">تهیه‌شده در ${formatReportDate(new Date().toISOString())}</p>
            </header>
            <div class="content">
              <section class="stats">
                <div class="stat"><span class="stat-label">پیشرفت کلی</span><strong class="stat-value">${progress.toLocaleString("fa-IR")}٪</strong></div>
                <div class="stat"><span class="stat-label">کل وظایف</span><strong class="stat-value">${totalTasks.toLocaleString("fa-IR")}</strong></div>
                <div class="stat"><span class="stat-label">تعداد اسپرینت‌ها</span><strong class="stat-value">${project._count.sprints.toLocaleString("fa-IR")}</strong></div>
              </section>
              <section class="section">
                <h2>اطلاعات پروژه</h2>
                <p class="description">${escapeHtml(project.description || "توضیحی برای این پروژه ثبت نشده است.")}</p>
                <table>
                  <tbody>
                    <tr><th>وضعیت</th><td>${escapeHtml(statusLabels[project.status])}</td></tr>
                    <tr><th>اولویت</th><td>${escapeHtml(priorityLabels[project.priority])}</td></tr>
                    <tr><th>تاریخ شروع</th><td>${formatReportDate(project.startDate)}</td></tr>
                    <tr><th>تاریخ پایان</th><td>${formatReportDate(project.dueDate)}</td></tr>
                  </tbody>
                </table>
              </section>
              <section class="section">
                <h2>وضعیت وظایف</h2>
                <table class="task-table"><thead><tr><th>وضعیت</th><th>تعداد</th></tr></thead><tbody>${taskRows}</tbody></table>
              </section>
              <section class="section">
                <h2>اعضای پروژه</h2>
                <table><thead><tr><th>نام</th><th>نقش</th></tr></thead><tbody>${memberRows}</tbody></table>
              </section>
              <p class="footer">این گزارش به‌صورت خودکار از اطلاعات ثبت‌شده در سامانه تهیه شده است.</p>
            </div>
          </main>
        </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(report);
    printWindow.document.close();

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  }

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
    <div className="space-y-3">
      <section aria-labelledby="overview-heading" className="rounded-2xl border border-[var(--border)] bg-white p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="overview-heading" className="text-base font-extrabold text-[var(--foreground)]">نمای کلی پروژه</h2>
            <p className="mt-0.5 text-sm leading-6 text-[var(--muted)]">{project.description || "توضیحی ثبت نشده است."}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {statusLabels[project.status]}
            </span>
            <button
              type="button"
              onClick={printProjectReport}
              title="در پنجره چاپ، ذخیره به صورت PDF را انتخاب کنید"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <FileDown size={15} />
              دریافت PDF
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3 xl:grid-cols-4">
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

          <Info
            label="پیشرفت"
            value={`${progress.toLocaleString("fa-IR")}٪`}
            icon={<Activity size={20} />}
          />
        </div>
      </section>

      <ProjectCharts
        progress={progress}
        taskStats={taskStats}
        totalTasks={totalTasks}
      />

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

      <div className="grid items-start gap-3 md:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">اطلاعات پروژه</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">مشخصات و زمان‌بندی پروژه</p>
              </div>
              <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">{priorityLabels[priority]}</span>
            </div>

            <details open className="group mt-3 border-t border-[var(--border)] pt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-emerald-700">
                {canEdit ? "ویرایش اطلاعات پروژه" : "مشاهده اطلاعات پروژه"}
                <ChevronDown aria-hidden="true" size={18} className="mr-auto text-[var(--muted)] transition-transform group-open:rotate-180" />
              </summary>

            {!isAdmin && (
              <p className="mt-1 text-xs leading-6 text-slate-500">
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
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              <Field label="نام پروژه" className="sm:col-span-2">
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

              <Field label="توضیحات" className="sm:col-span-2">
                <textarea
                  className={inputClass}
                  rows={2}
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

              <div>
                <PersianDatePicker label="تاریخ شروع" value={startDate} onChange={setStartDate} disabled={!isAdmin} />
              </div>

              <div>
                <PersianDatePicker label="تاریخ پایان" value={dueDate} onChange={setDueDate} disabled={!isAdmin} />
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={Boolean(busy)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
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
            </details>
          </section>
          <section className="overflow-visible rounded-2xl border border-[var(--border)] bg-white p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold">
              <Users
                size={18}
                className="text-emerald-600"
              />
              اعضای پروژه
              </h2>
              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                {project.members.length.toLocaleString("fa-IR")} نفر
              </span>
            </div>

            <details open className="group mt-3 border-t border-[var(--border)] pt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-emerald-700">
                {canEdit ? "مدیریت اعضا" : "مشاهده اعضا"}
                <ChevronDown aria-hidden="true" size={18} className="mr-auto text-[var(--muted)] transition-transform group-open:rotate-180" />
              </summary>
            {canEdit ? (
              <div className="mt-3 grid gap-3">
                {isAdmin ? (
                  <UserMultiSelect
                    label="مدیران پروژه"
                    role="MANAGER"
                    projectId={project.id}
                    selected={managers}
                    onChange={setManagers}
                  />
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">
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
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
              <div className="mt-3 space-y-1.5">
                {project.members.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    هنوز عضوی ثبت نشده است.
                  </p>
                ) : (
                  project.members.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
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
            </details>
          </section>
          <section className="hidden rounded-2xl border border-[var(--border)] bg-white p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Activity
                  size={20}
                  className="text-emerald-600"
                />
                پیشرفت پروژه
              </h2>

              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                محاسبه خودکار
              </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-2xl font-extrabold tabular-nums text-emerald-700">{progress.toLocaleString("fa-IR")}٪</p>
              <p className="text-xs text-[var(--muted)]">از {totalTasks.toLocaleString("fa-IR")} تسک فعال</p>
            </div>

            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100"
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

            {totalTasks === 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs leading-5 text-amber-800">
                هنوز تسکی در پروژه وجود ندارد؛
                پیشرفت صفر درصد است.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
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

            <Link
              href={`/projects/${project.id}/tasks`}
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <ListTodo size={17} />
              وظایف پروژه
              <ArrowLeft size={15} />
            </Link>
          </section>

          <details className="hidden group rounded-2xl border border-[var(--border)] bg-white p-3.5 sm:p-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-bold text-slate-900">
              <CheckCircle2
                size={20}
                className="text-emerald-600"
              />
              نحوه محاسبه پیشرفت
              <ChevronDown aria-hidden="true" size={18} className="mr-auto text-[var(--muted)] transition-transform group-open:rotate-180" />
            </summary>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              پیشرفت براساس وضعیت واقعی تسک‌ها
              محاسبه می‌شود. ایجاد، حذف یا تغییر
              وضعیت تسک‌ها روی درصد پروژه اثر
              می‌گذارد.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
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
          </details>
      </div>
    </div>
  );
}

function ProjectCharts({
  progress,
  taskStats,
  totalTasks,
}: {
  progress: number;
  taskStats: TaskStats;
  totalTasks: number;
}) {
  const entries = Object.keys(taskStatusLabels).map(
    (status) => {
      const key = status as TaskStatus;

      return {
        status: key,
        label: taskStatusLabels[key],
        value: taskStats[key],
        color: taskStatusChartColors[key],
      };
    }
  );

  const highestValue = Math.max(
    1,
    ...entries.map((entry) => entry.value)
  );

  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <section aria-labelledby="project-charts-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2
            id="project-charts-title"
            className="text-base font-extrabold text-slate-900"
          >
            وضعیت پروژه
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            نمای زنده از پیشرفت و توزیع وظایف
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <TrendingUp size={17} className="text-emerald-600" />
            پیشرفت کلی
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative size-28 shrink-0">
              <svg
                viewBox="0 0 100 100"
                className="size-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#d1fae5"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <strong className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-emerald-700">
                {progress.toLocaleString("fa-IR")}٪
              </strong>
            </div>

            <p className="text-xs leading-6 text-[var(--muted)]">
              پیشرفت براساس وضعیت واقعی تمام وظایف محاسبه می‌شود.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <PieChart size={17} className="text-sky-600" />
            توزیع وضعیت‌ها
          </div>

          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {entries.map((entry) => (
              <span
                key={entry.status}
                title={`${entry.label}: ${entry.value.toLocaleString("fa-IR")}`}
                className="transition-all duration-500"
                style={{
                  width: `${totalTasks ? (entry.value / totalTasks) * 100 : 0}%`,
                  backgroundColor: entry.color,
                }}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
            {entries.map((entry) => (
              <div
                key={entry.status}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate">{entry.label}</span>
                </span>
                <strong className="text-slate-800">
                  {entry.value.toLocaleString("fa-IR")}
                </strong>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <BarChart3 size={17} className="text-amber-600" />
            حجم کار در مراحل
          </div>

          <div className="mt-5 flex h-28 items-end justify-between gap-3 border-b border-slate-100 px-1">
            {entries.map((entry) => (
              <div
                key={entry.status}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              >
                <strong className="text-xs text-slate-700">
                  {entry.value.toLocaleString("fa-IR")}
                </strong>
                <div
                  className="w-full max-w-9 rounded-t-md transition-all duration-500"
                  style={{
                    height: `${Math.max(8, (entry.value / highestValue) * 78)}px`,
                    backgroundColor: entry.color,
                  }}
                  title={entry.label}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px] text-slate-500">
            {entries.map((entry) => (
              <span key={entry.status} className="truncate">
                {entry.label}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
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
    <div className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-50/60 px-2.5 py-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-white text-emerald-700">
        {icon}
      </div>

      <div>
        <p className="text-[11px] text-slate-500">
          {label}
        </p>

        <p className="text-sm font-bold">
          {value}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
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
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
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

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character
  );
}

function formatReportDate(value: string | null) {
  if (!value) return "ثبت نشده";

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}
