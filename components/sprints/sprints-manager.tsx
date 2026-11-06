
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  FolderPlus,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
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

const statuses: Record<SprintStatus, string> = {
  PLANNED: "برنامه‌ریزی‌شده",
  ACTIVE: "در حال اجرا",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

const taskStatuses: Record<TaskStatus, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در حال بررسی",
  DONE: "تکمیل‌شده",
};

const statusColors: Record<SprintStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

function errorMessage(error: unknown) {
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

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

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
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function send(
    method: "POST" | "PATCH" | "DELETE",
    body: unknown
  ) {
    const response = await fetch(
      `/api/v1/projects/${projectId}/sprints`,
      {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "عملیات ناموفق بود."
      );
    }

    return data;
  }

  async function createSprint(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy || !canManage) return;

    if (!startDate || !endDate) {
      setError("تاریخ شروع و پایان را انتخاب کنید.");
      return;
    }

    if (startDate > endDate) {
      setError("تاریخ پایان قبل از تاریخ شروع است.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const data = await send("POST", {
        name,
        startDate,
        endDate,
      });

      setSprints((previous) => [
        data.sprint,
        ...previous,
      ]);

      setName("");
      setStartDate(null);
      setEndDate(null);
      setCreating(false);
      setExpandedId(data.sprint.id);
    } catch (err) {
      setError(errorMessage(err));
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
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function addTask(sprintId: string) {
    if (!selectedTaskId || busy || !canManage) return;

    const taskId = selectedTaskId;

    setBusy(true);
    setError("");

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
      setTaskSearch("");
    } catch (err) {
      setError(errorMessage(err));
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
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSprint() {
    if (!deletingId || busy || !canDelete) return;

    const id = deletingId;

    setBusy(true);
    setError("");

    try {
      await send("DELETE", {
        sprintId: id,
      });

      setSprints((previous) =>
        previous.filter((sprint) => sprint.id !== id)
      );

      setTasks((previous) =>
        previous.map((task) =>
          task.sprintId === id
            ? { ...task, sprintId: null }
            : task
        )
      );

      if (expandedId === id) setExpandedId(null);
      setDeletingId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const visibleSprints = useMemo(
    () =>
      sprints.filter((sprint) => {
        const matchesName = sprint.name
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase());

        const matchesStatus =
          filter === "ALL" ||
          sprint.status === filter;

        return matchesName && matchesStatus;
      }),
    [sprints, search, filter]
  );

  const availableTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.sprintId === null &&
          task.title
            .toLocaleLowerCase()
            .includes(
              taskSearch.trim().toLocaleLowerCase()
            )
      ),
    [tasks, taskSearch]
  );

  const activeCount = sprints.filter(
    (sprint) => sprint.status === "ACTIVE"
  ).length;

  const finishedCount = sprints.filter(
    (sprint) => sprint.status === "COMPLETED"
  ).length;

  function expandSprint(id: string) {
    setExpandedId((current) =>
      current === id ? null : id
    );
    setSelectedTaskId("");
    setTaskSearch("");
  }

  return (
    <div className="space-y-6">
      {/* Page actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            برنامه اسپرینت‌ها
          </h2>

          <p className="mt-1.5 text-sm text-slate-500">
            دوره‌های کاری، تسک‌ها و میزان پیشرفت
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-md shadow-emerald-600/15 transition hover:bg-emerald-700"
          >
            <Plus size={18} />
            اسپرینت جدید
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="تمام اسپرینت‌ها"
          value={sprints.length}
          icon={<Layers3 size={20} />}
          color="emerald"
        />
        <Stat
          label="در حال اجرا"
          value={activeCount}
          icon={<Clock3 size={20} />}
          color="emerald"
        />
        <Stat
          label="تکمیل‌شده"
          value={finishedCount}
          icon={<CheckCircle2 size={20} />}
          color="emerald"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <span>{error}</span>
          <button
            type="button"
            aria-label="بستن پیام"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
            aria-label="جست‌وجوی اسپرینت"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="جست‌وجوی اسپرینت..."
            className={`${inputClass} pr-10`}
          />
        </div>

        <select
          aria-label="فیلتر وضعیت اسپرینت"
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value)
          }
          className={`${inputClass} sm:w-48`}
        >
          <option value="ALL">همه وضعیت‌ها</option>

          {Object.entries(statuses).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-60 items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white">
          <LoaderCircle
            size={24}
            className="animate-spin text-emerald-600"
          />
          <span className="text-sm text-slate-500">
            دریافت اسپرینت‌ها...
          </span>
        </div>
      ) : visibleSprints.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CalendarRange size={29} />
          </div>

          <h3 className="mt-5 font-bold text-slate-800">
            {search || filter !== "ALL"
              ? "اسپرینتی پیدا نشد"
              : "هنوز اسپرینتی ندارید"}
          </h3>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-slate-500">
            {search || filter !== "ALL"
              ? "عبارت جست‌وجو یا فیلتر را تغییر دهید."
              : "یک بازه کاری تعریف کنید و وظایف پروژه را به آن اختصاص دهید."}
          </p>

          {canManage &&
            !search &&
            filter === "ALL" && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                ساخت اولین اسپرینت
              </button>
            )}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {visibleSprints.map((sprint) => {
            const sprintTasks = tasks.filter(
              (task) =>
                task.sprintId === sprint.id
            );

            const done = sprintTasks.filter(
              (task) => task.status === "DONE"
            ).length;

            const progress =
              sprintTasks.length > 0
                ? Math.round(
                    (done / sprintTasks.length) * 100
                  )
                : 0;

            const expanded =
              expandedId === sprint.id;

            const closed =
              sprint.status === "COMPLETED" ||
              sprint.status === "CANCELLED";

            return (
              <article
                key={sprint.id}
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
                  expanded
                    ? "border-emerald-300 shadow-lg shadow-emerald-500/5 lg:col-span-2"
                    : "border-slate-200 hover:border-emerald-200 hover:shadow-md"
                }`}
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        expandSprint(sprint.id)
                      }
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-start gap-3 text-right"
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <CalendarDays size={23} />
                      </div>

                      <div className="min-w-0">
                        <h3 className="break-words text-base font-extrabold text-slate-900">
                          {sprint.name}
                        </h3>

                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          {sprint.startDate
                            ? isoToJalali(
                                sprint.startDate
                              )
                            : "بدون تاریخ"}
                          {" — "}
                          {sprint.endDate
                            ? isoToJalali(
                                sprint.endDate
                              )
                            : "بدون تاریخ"}
                        </p>
                      </div>

                      <ChevronDown
                        size={18}
                        className={`mr-auto mt-2 shrink-0 text-slate-400 transition ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        title="حذف اسپرینت"
                        aria-label={`حذف ${sprint.name}`}
                        onClick={() =>
                          setDeletingId(sprint.id)
                        }
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
                        className={`rounded-lg border-0 px-3 py-2 text-xs font-bold outline-none disabled:opacity-50 ${statusColors[sprint.status]}`}
                      >
                        {Object.entries(statuses).map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    ) : (
                      <span
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${statusColors[sprint.status]}`}
                      >
                        {statuses[sprint.status]}
                      </span>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CircleDashed size={15} />
                      {sprintTasks.length.toLocaleString(
                        "fa-IR"
                      )}{" "}
                      تسک
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          پیشرفت اسپرینت
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {done.toLocaleString("fa-IR")} وظیفه
                          تکمیل‌شده
                        </p>
                      </div>

                      <strong className="text-2xl font-extrabold text-emerald-600">
                        {progress.toLocaleString(
                          "fa-IR"
                        )}
                        ٪
                      </strong>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress === 100
                            ? "bg-emerald-500"
                            : "bg-emerald-600"
                        }`}
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-5 border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          وظایف اسپرینت
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          تسک‌های مرتبط با این دوره
                        </p>
                      </div>

                      <Link
                        href={`/projects/${projectId}/tasks`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-600 hover:border-emerald-200"
                      >
                        مدیریت وظایف
                        <ArrowUpLeft size={15} />
                      </Link>
                    </div>

                    {sprintTasks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-7 text-center">
                        <FolderPlus
                          size={25}
                          className="mx-auto text-slate-300"
                        />
                        <p className="mt-3 text-sm text-slate-500">
                          هنوز تسکی به این اسپرینت اضافه نشده است.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {sprintTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {task.status === "DONE" ? (
                                  <CheckCircle2
                                    size={17}
                                    className="shrink-0 text-emerald-500"
                                  />
                                ) : (
                                  <CircleDashed
                                    size={17}
                                    className="shrink-0 text-slate-300"
                                  />
                                )}

                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {task.title}
                                </p>
                              </div>

                              <p className="mt-2 text-xs text-slate-500">
                                {taskStatuses[task.status]}
                                {" · "}
                                {task.assignee?.name ??
                                  "بدون مسئول"}
                              </p>
                            </div>

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
                                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                خارج کردن
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {canManage && !closed && (
                      <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
                        <h4 className="text-sm font-bold text-slate-900">
                          افزودن وظیفه به اسپرینت
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          فقط وظایفی که در اسپرینت دیگری نیستند نمایش داده می‌شوند.
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <div className="relative">
                            <Search
                              size={16}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                              type="search"
                              value={taskSearch}
                              onChange={(event) => {
                                setTaskSearch(
                                  event.target.value
                                );
                                setSelectedTaskId("");
                              }}
                              placeholder="جست‌وجوی تسک..."
                              className={`${inputClass} pr-10`}
                            />
                          </div>

                          <select
                            aria-label="انتخاب تسک"
                            value={selectedTaskId}
                            onChange={(event) =>
                              setSelectedTaskId(
                                event.target.value
                              )
                            }
                            className={inputClass}
                          >
                            <option value="">
                              انتخاب وظیفه...
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
                              void addTask(sprint.id)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Plus size={17} />
                            افزودن
                          </button>
                        </div>
                      </div>
                    )}

                    {closed && canManage && (
                      <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
                        این اسپرینت بسته است. برای تغییر
                        تسک‌های آن، ابتدا وضعیت را به
                        برنامه‌ریزی‌شده یا فعال تغییر دهید.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Create sprint modal */}
      {creating && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setCreating(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sprint-modal-title"
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CalendarRange size={24} />
                </div>

                <h2
                  id="sprint-modal-title"
                  className="text-xl font-extrabold text-slate-900"
                >
                  ساخت اسپرینت جدید
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  یک دوره زمانی برای برنامه‌ریزی فعالیت‌های
                  تیم تعریف کنید.
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
              className="mt-7 space-y-5"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  نام اسپرینت
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
                  placeholder="مثلاً اسپرینت اول — طراحی رابط کاربری"
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
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
                  )}
                  ایجاد اسپرینت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <ConfirmDialog
          title="حذف اسپرینت"
          description="اسپرینت حذف می‌شود، اما تسک‌های آن و تاریخچه تسک‌ها باقی می‌مانند."
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
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "emerald";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
      >
        {icon}
      </div>

      <div>
        <p className="text-xs text-slate-500">
          {label}
        </p>

        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {value.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}
