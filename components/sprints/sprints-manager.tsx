
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import PersianDatePicker from "@/components/ui/persian-date-picker";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { isoToJalali } from "@/lib/jalali";

type SprintStatus =
  | "PLANNED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

type Sprint = {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
};

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  sprintId: string | null;
  assignee: {
    id: string;
    name: string;
  } | null;
};

type Props = {
  projectId: string;
  canManage: boolean;
  canDelete: boolean;
};

const sprintStatuses: Record<SprintStatus, string> = {
  PLANNED: "برنامه‌ریزی‌شده",
  ACTIVE: "فعال",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

const taskStatuses: Record<TaskStatus, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در حال بررسی",
  DONE: "انجام‌شده",
};

const statusColors: Record<SprintStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}

export default function SprintsManager({
  projectId,
  canManage,
  canDelete,
}: Props) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<string | null>(
    null
  );
  const [endDate, setEndDate] = useState<string | null>(
    null
  );

  const [selectedTaskId, setSelectedTaskId] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/sprints`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت اسپرینت‌ها انجام نشد."
        );
      }

      setSprints(data.sprints ?? []);
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(
    method: "POST" | "PATCH" | "DELETE",
    body: unknown
  ) {
    const response = await fetch(
      `/api/v1/projects/${projectId}/sprints`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "عملیات ناموفق بود.");
    }

    return data;
  }

  async function createSprint(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy || !canManage) return;

    if (!startDate || !endDate) {
      setError("هر دو تاریخ اسپرینت را انتخاب کنید.");
      return;
    }

    if (startDate > endDate) {
      setError("تاریخ پایان قبل از شروع است.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await send("POST", {
        name,
        startDate,
        endDate,
      });

      setSprints((previous) => [
        result.sprint,
        ...previous,
      ]);

      setName("");
      setStartDate(null);
      setEndDate(null);
      setCreating(false);

      setExpandedId(result.sprint.id);
      setNotice("اسپرینت جدید ساخته شد.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(
    sprintId: string,
    status: SprintStatus
  ) {
    if (busy || !canManage) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await send("PATCH", {
        action: "SET_STATUS",
        sprintId,
        status,
      });

      setSprints((previous) =>
        previous.map((sprint) =>
          sprint.id === sprintId
            ? { ...sprint, status }
            : sprint
        )
      );

      setNotice("وضعیت اسپرینت تغییر کرد.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function assignTask(
    sprintId: string,
    taskId: string
  ) {
    if (!taskId || busy || !canManage) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await send("PATCH", {
        action: "ASSIGN_TASK",
        sprintId,
        taskId,
      });

      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId
            ? { ...task, sprintId }
            : task
        )
      );

      setSelectedTaskId("");
      setNotice("تسک به اسپرینت اضافه شد.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeTask(
    sprintId: string,
    taskId: string
  ) {
    if (busy || !canManage) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await send("PATCH", {
        action: "REMOVE_TASK",
        sprintId,
        taskId,
      });

      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId
            ? { ...task, sprintId: null }
            : task
        )
      );

      setNotice("تسک از اسپرینت خارج شد.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSprint() {
    if (!deletingId || busy || !canDelete) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await send("DELETE", {
        sprintId: deletingId,
      });

      setSprints((previous) =>
        previous.filter((s) => s.id !== deletingId)
      );

      setTasks((previous) =>
        previous.map((task) =>
          task.sprintId === deletingId
            ? { ...task, sprintId: null }
            : task
        )
      );

      if (expandedId === deletingId) {
        setExpandedId(null);
      }

      setDeletingId(null);
      setNotice("اسپرینت حذف شد و تسک‌ها باقی ماندند.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const availableTasks = tasks.filter(
    (task) => task.sprintId === null
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            اسپرینت‌های پروژه
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            مدیریت دوره‌های کاری و برنامه‌ریزی تسک‌ها
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={18} />
            اسپرینت جدید
          </button>
        )}
      </div>

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="کل اسپرینت‌ها" value={sprints.length} />
        <Stat
          label="فعال"
          value={
            sprints.filter((s) => s.status === "ACTIVE").length
          }
        />
        <Stat
          label="تکمیل‌شده"
          value={
            sprints.filter((s) => s.status === "COMPLETED")
              .length
          }
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoaderCircle
            size={26}
            className="animate-spin text-indigo-600"
          />
        </div>
      ) : sprints.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <CalendarDays
            size={35}
            className="mx-auto text-slate-300"
          />
          <p className="mt-4 text-sm text-slate-500">
            هنوز اسپرینتی ایجاد نشده است.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sprints.map((sprint) => {
            const sprintTasks = tasks.filter(
              (task) => task.sprintId === sprint.id
            );

            const completed = sprintTasks.filter(
              (task) => task.status === "DONE"
            ).length;

            const progress = sprintTasks.length
              ? Math.round(
                  (completed / sprintTasks.length) * 100
                )
              : 0;

            const expanded = expandedId === sprint.id;
            const closed =
              sprint.status === "COMPLETED" ||
              sprint.status === "CANCELLED";

            return (
              <article
                key={sprint.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-3 text-right"
                      onClick={() => {
                        setExpandedId(
                          expanded ? null : sprint.id
                        );
                        setSelectedTaskId("");
                      }}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <CalendarDays size={21} />
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900">
                          {sprint.name}
                        </h3>
                        <p className="mt-2 text-xs text-slate-500">
                          {sprint.startDate
                            ? isoToJalali(sprint.startDate)
                            : "بدون تاریخ"}
                          {" تا "}
                          {sprint.endDate
                            ? isoToJalali(sprint.endDate)
                            : "بدون تاریخ"}
                        </p>
                      </div>

                      <ChevronDown
                        size={17}
                        className={`text-slate-400 transition ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {canManage ? (
                        <select
                          aria-label={`وضعیت ${sprint.name}`}
                          value={sprint.status}
                          disabled={busy}
                          onChange={(event) =>
                            void changeStatus(
                              sprint.id,
                              event.target.value as SprintStatus
                            )
                          }
                          className={`rounded-lg border-0 px-3 py-2 text-xs font-semibold outline-none ${statusColors[sprint.status]}`}
                        >
                          {Object.entries(sprintStatuses).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span
                          className={`rounded-lg px-3 py-2 text-xs ${statusColors[sprint.status]}`}
                        >
                          {sprintStatuses[sprint.status]}
                        </span>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`حذف ${sprint.name}`}
                          onClick={() => setDeletingId(sprint.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex justify-between text-xs text-slate-500">
                      <span>
                        {sprintTasks.length.toLocaleString("fa-IR")} وظیفه
                        {" — "}
                        {completed.toLocaleString("fa-IR")} تکمیل‌شده
                      </span>
                      <strong className="text-indigo-600">
                        {progress.toLocaleString("fa-IR")}٪
                      </strong>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <ClipboardList
                        size={18}
                        className="text-indigo-600"
                      />
                      <h4 className="text-sm font-bold text-slate-900">
                        وظایف این اسپرینت
                      </h4>
                    </div>

                    {sprintTasks.length === 0 ? (
                      <p className="rounded-xl bg-white p-4 text-sm text-slate-400">
                        هنوز وظیفه‌ای به این اسپرینت اضافه نشده است.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sprintTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">
                                {task.title}
                              </p>
                              <p className="mt-2 text-xs text-slate-500">
                                {taskStatuses[task.status]}
                                {" · "}
                                {task.assignee?.name ?? "بدون مسئول"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {task.status === "DONE" && (
                                <CheckCircle2
                                  size={18}
                                  className="text-emerald-600"
                                />
                              )}

                              {canManage && !closed && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void removeTask(
                                      sprint.id,
                                      task.id
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  خارج کردن
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canManage && !closed && (
                      <div className="rounded-xl border border-indigo-100 bg-white p-4">
                        <p className="mb-3 text-sm font-semibold text-slate-800">
                          افزودن تسک موجود
                        </p>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <select
                            value={selectedTaskId}
                            onChange={(event) =>
                              setSelectedTaskId(event.target.value)
                            }
                            className={inputClass}
                          >
                            <option value="">
                              انتخاب تسک خارج از اسپرینت...
                            </option>

                            {availableTasks.map((task) => (
                              <option
                                key={task.id}
                                value={task.id}
                              >
                                {task.title}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={busy || !selectedTaskId}
                            onClick={() =>
                              void assignTask(
                                sprint.id,
                                selectedTaskId
                              )
                            }
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            <Plus size={17} />
                            افزودن
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-sprint-title"
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3
                  id="create-sprint-title"
                  className="text-xl font-extrabold text-slate-900"
                >
                  اسپرینت جدید
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  نام و بازه زمانی اسپرینت را مشخص کنید.
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                aria-label="بستن"
                onClick={() => setCreating(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={createSprint}
              className="mt-6 space-y-5"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  عنوان اسپرینت
                </span>
                <input
                  required
                  minLength={3}
                  maxLength={150}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="مثلاً اسپرینت اول — طراحی رابط کاربری"
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <PersianDatePicker
                  label="تاریخ شروع"
                  value={startDate}
                  onChange={setStartDate}
                />
                <PersianDatePicker
                  label="تاریخ پایان"
                  value={endDate}
                  onChange={setEndDate}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCreating(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
                  )}
                  ثبت اسپرینت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <ConfirmDialog
          title="حذف اسپرینت"
          description="فقط خود اسپرینت حذف می‌شود. تسک‌ها، کامنت‌ها و تاریخچه تسک‌ها باقی می‌مانند و می‌توانید آن‌ها را به اسپرینت دیگری اضافه کنید."
          busy={busy}
          onCancel={() => setDeletingId(null)}
          onConfirm={() => void deleteSprint()}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">
        {value.toLocaleString("fa-IR")}
      </p>
    </div>
  );
}
