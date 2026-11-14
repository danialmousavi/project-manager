
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Filter,
  GripVertical,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { isoToJalali } from "@/lib/jalali";
import { TaskFormModal, type FormValues, type MilestoneOption } from "@/components/tasks/project-tasks";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

type TaskPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

type KanbanTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  sprintId: string | null;
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string;
  } | null;
};

type Sprint = {
  id: string;
  name: string;
  status: string;
};

type ActiveSprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  remainingDays: number | null;
  completedTasks: number;
  storyPoints: number;
};

type KanbanResponse = {
  success: boolean;
  message?: string;
  tasks: KanbanTask[];
  sprints: Sprint[];
  canManage: boolean;
  totalTasks: number;
  truncated: boolean;
  activeSprint: ActiveSprint | null;
};

type Props = {
  projectId: string;
  projectName: string;
};

type KanbanColumn = {
  id: TaskStatus;
  title: string;
  description: string;
  dotClass: string;
  headerClass: string;
  emptyBorderClass: string;
};

const columns: KanbanColumn[] = [
  {
    id: "TODO",
    title: "برای انجام",
    description: "فعالیت‌های برنامه‌ریزی‌شده",
    dotClass: "bg-slate-400",
    headerClass: "bg-slate-100 text-slate-700",
    emptyBorderClass: "border-slate-200",
  },
  {
    id: "IN_PROGRESS",
    title: "در حال انجام",
    description: "فعالیت‌های در حال اجرا",
    dotClass: "bg-sky-500",
    headerClass: "bg-sky-50 text-sky-800",
    emptyBorderClass: "border-sky-200",
  },
  {
    id: "IN_REVIEW",
    title: "در حال بررسی",
    description: "فعالیت‌های آماده تأیید",
    dotClass: "bg-amber-500",
    headerClass: "bg-amber-50 text-amber-800",
    emptyBorderClass: "border-amber-200",
  },
  {
    id: "DONE",
    title: "انجام‌شده",
    description: "فعالیت‌های تکمیل‌شده",
    dotClass: "bg-emerald-500",
    headerClass: "bg-emerald-100 text-emerald-700",
    emptyBorderClass: "border-emerald-200",
  },
];

const statusLabels: Record<TaskStatus, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در حال بررسی",
  DONE: "انجام‌شده",
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const priorityStyles: Record<TaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-sky-50 text-sky-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-rose-50 text-rose-700",
};

const inputClass =
  "h-10 w-full rounded-lg border bg-white px-2.5 " +
  "text-xs outline-none transition " +
  "focus:ring-4 focus:ring-emerald-500/10";

const panelClass =
  "rounded-xl border bg-white shadow-sm";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}

function validStatus(
  value: string
): value is TaskStatus {
  return (
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "IN_REVIEW" ||
    value === "DONE"
  );
}

function displayDate(value: string | null) {
  if (!value) return null;

  const normalized = value.slice(0, 10);

  return isoToJalali(normalized) || normalized;
}

export default function KanbanBoard({
  projectId,
  projectName,
}: Props) {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] =
    useState<ActiveSprint | null>(null);
  const [milestones, setMilestones] = useState<MilestoneOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [canManage, setCanManage] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [totalTasks, setTotalTasks] = useState(0);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");

  const [sprintFilter, setSprintFilter] =
    useState("ALL");

  const [assigneeFilter, setAssigneeFilter] =
    useState("ALL");

  const [priorityFilter, setPriorityFilter] =
    useState("ALL");

  const [quickTask, setQuickTask] = useState<{
    status: TaskStatus;
  } | null>(null);

  const [draggedTaskId, setDraggedTaskId] =
    useState<string | null>(null);

  const [dragOverStatus, setDragOverStatus] =
    useState<TaskStatus | null>(null);

  const [savingTaskId, setSavingTaskId] =
    useState<string | null>(null);

  const savingRef = useRef(false);

  const loadBoard = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setRefreshing(true);
      }

      try {
        const [response, milestonesResponse] = await Promise.all([
          fetch(`/api/v1/projects/${projectId}/kanban`, {
            cache: "no-store",
            credentials: "same-origin",
          }),
          fetch(`/api/v1/projects/${projectId}/milestones`, {
            cache: "no-store",
            credentials: "same-origin",
          }),
        ]);

        const [data, milestonesData]: [KanbanResponse, { milestones?: MilestoneOption[] }] = await Promise.all([
          response.json(),
          milestonesResponse.json(),
        ]);

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "دریافت اطلاعات کانبان ناموفق بود."
          );
        }

        setTasks(data.tasks ?? []);
        setSprints(data.sprints ?? []);
        setActiveSprint(data.activeSprint ?? null);
        if (milestonesResponse.ok) setMilestones(milestonesData.milestones ?? []);

        setCanManage(data.canManage);
        setTruncated(data.truncated);
        setTotalTasks(data.totalTasks);

        setError("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBoard(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBoard]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();

    for (const task of tasks) {
      if (task.assignee) {
        map.set(
          task.assignee.id,
          task.assignee.name
        );
      }
    }

    return [...map.entries()]
      .map(([id, name]) => ({
        id,
        name,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "fa")
      );
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const text = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesText =
        !text ||
        task.title.toLowerCase().includes(text) ||
        (task.description ?? "")
          .toLowerCase()
          .includes(text) ||
        (task.assignee?.name ?? "")
          .toLowerCase()
          .includes(text);

      const matchesSprint =
        sprintFilter === "ALL" ||
        (sprintFilter === "BACKLOG"
          ? task.sprintId === null
          : task.sprintId === sprintFilter);

      const matchesAssignee =
        assigneeFilter === "ALL" ||
        (assigneeFilter === "UNASSIGNED"
          ? task.assigneeId === null
          : task.assigneeId === assigneeFilter);

      const matchesPriority =
        priorityFilter === "ALL" ||
        task.priority === priorityFilter;

      return (
        matchesText &&
        matchesSprint &&
        matchesAssignee &&
        matchesPriority
      );
    });
  }, [
    tasks,
    search,
    sprintFilter,
    assigneeFilter,
    priorityFilter,
  ]);

  const taskGroups = useMemo(() => {
    const groups: Record<
      TaskStatus,
      KanbanTask[]
    > = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };

    for (const task of filteredTasks) {
      if (validStatus(task.status)) {
        groups[task.status].push(task);
      }
    }

    return groups;
  }, [filteredTasks]);

  const completedCount = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const progress = tasks.length
    ? Math.round(
        (completedCount / tasks.length) * 100
      )
    : 0;

  const clearFilters = () => {
    setSearch("");
    setSprintFilter("ALL");
    setAssigneeFilter("ALL");
    setPriorityFilter("ALL");
  };

  const hasFilters =
    Boolean(search) ||
    sprintFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    priorityFilter !== "ALL";

  async function moveTask(
    taskId: string,
    nextStatus: TaskStatus
  ) {
    if (savingRef.current) return;

    const currentTask = tasks.find(
      (task) => task.id === taskId
    );

    if (!currentTask) {
      setError("تسک انتخاب‌شده پیدا نشد.");
      return;
    }

    if (currentTask.status === nextStatus) {
      return;
    }

    savingRef.current = true;
    setSavingTaskId(taskId);

    setError("");
    setNotice("");

    const previousStatus = currentTask.status;

    setTasks((previous) =>
      previous.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatus,
            }
          : task
      )
    );

    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "تغییر وضعیت تسک ذخیره نشد."
        );
      }

      setNotice(
        `وضعیت «${currentTask.title}» به «${statusLabels[nextStatus]}» تغییر کرد.`
      );
    } catch (err) {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: previousStatus,
              }
            : task
        )
      );

      setError(errorMessage(err));
    } finally {
      savingRef.current = false;
      setSavingTaskId(null);
    }
  }

  async function createQuickTask(values: FormValues) {
    if (!quickTask) return;

    setSavingTaskId("new-task");
    setError("");
    try {
      const { note, dependencyTaskIds, ...payload } = values;
      void note;
      const response = await fetch(
        `/api/v1/projects/${projectId}/tasks`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: quickTask.status }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ایجاد تسک ناموفق بود.");
      await Promise.all(dependencyTaskIds.map((prerequisiteTaskId) => fetch(`/api/v1/tasks/${data.task.id}/dependencies`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prerequisiteTaskId }) })));
      await fetch(`/api/v1/projects/${projectId}/backlog`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MOVE_TASK",
          taskId: data.task.id,
          sprintId: activeSprint?.id ?? null,
        }),
      });
      setQuickTask(null);
      setNotice("تسک جدید به اسپرینت فعال اضافه شد.");
      await loadBoard(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingTaskId(null);
    }
  }

  function onDragStart(
    event: DragEvent<HTMLElement>,
    taskId: string
  ) {
    if (savingRef.current) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";

    event.dataTransfer.setData(
      "text/plain",
      taskId
    );

    setDraggedTaskId(taskId);
  }

  function onDragOver(
    event: DragEvent<HTMLElement>,
    status: TaskStatus
  ) {
    if (
      !draggedTaskId ||
      savingRef.current
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverStatus !== status) {
      setDragOverStatus(status);
    }
  }

  function onDrop(
    event: DragEvent<HTMLElement>,
    status: TaskStatus
  ) {
    event.preventDefault();

    const taskId =
      event.dataTransfer.getData("text/plain") ||
      draggedTaskId;

    setDraggedTaskId(null);
    setDragOverStatus(null);

    if (!taskId) return;

    // Only allow dragging cards from this board.
    if (!tasks.some((task) => task.id === taskId)) {
      return;
    }

    void moveTask(taskId, status);
  }

  function onDragEnd() {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  }

  return (
    <div
      dir="rtl"
      className="space-y-3"
      style={{
        color: "var(--foreground)",
        fontFamily: "inherit",
      }}
    >
      {/* Header */}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex size-9 items-center justify-center rounded-lg text-white"
              style={{
                backgroundColor: "var(--primary)",
              }}
            >
              <Layers3 size={18} aria-hidden="true" />
            </div>

            <div>
              <h2
                className="text-base font-extrabold"
                style={{
                  color: "var(--foreground)",
                }}
              >
                برد کانبان
              </h2>

              <p
                className="mt-0.5 text-xs"
                style={{
                  color: "var(--muted)",
                }}
              >
                {projectName}
              </p>
            </div>
          </div>

          <p
            className="mt-1.5 max-w-2xl text-xs leading-5"
            style={{
              color: "var(--muted)",
            }}
          >
            کارت‌ها را بین ستون‌ها جابه‌جا کنید.
            وضعیت جدید به‌صورت خودکار ذخیره می‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/projects/${projectId}/sprints`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-emerald-50 hover:text-emerald-700"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <CalendarDays size={15} />
            وظایف
          </Link>

          <button
            type="button"
            onClick={() => {
              if (!savingRef.current) {
                void loadBoard();
              }
            }}
            disabled={
              refreshing ||
              Boolean(savingTaskId)
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-emerald-50 disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <RefreshCw
              size={15}
              className={
                refreshing ? "animate-spin" : ""
              }
            />
            به‌روزرسانی
          </button>
        </div>
      </div>

      {/* Alerts */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          <AlertCircle
            size={17}
            className="shrink-0"
          />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            aria-label="بستن خطا"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"
        >
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}

      {truncated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          تعداد تسک‌ها بیشتر از ظرفیت این نمایش است.
          اکنون{" "}
          {tasks.length.toLocaleString("fa-IR")}
          {" "}تسک از{" "}
          {totalTasks.toLocaleString("fa-IR")}
          {" "}تسک بارگذاری شده است.
        </div>
      )}

      {activeSprint ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-emerald-700">اسپرینت فعال</p>
              <h3 className="mt-1 text-base font-extrabold text-emerald-950">{activeSprint.name}</h3>
              {activeSprint.goal && <p className="mt-1 max-w-3xl text-xs leading-5 text-emerald-900">{activeSprint.goal}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <SprintMetric label="بازه" value={`${displayDate(activeSprint.startDate) ?? "—"} تا ${displayDate(activeSprint.endDate) ?? "—"}`} />
              <SprintMetric label="زمان باقی‌مانده" value={activeSprint.remainingDays === null ? "—" : activeSprint.remainingDays < 0 ? "پایان‌یافته" : `${activeSprint.remainingDays.toLocaleString("fa-IR")} روز`} />
              <SprintMetric label="تکمیل‌شده" value={`${activeSprint.completedTasks.toLocaleString("fa-IR")} از ${totalTasks.toLocaleString("fa-IR")}`} />
              <SprintMetric label="Story Points" value={activeSprint.storyPoints.toLocaleString("fa-IR")} />
            </div>
          </div>
        </section>
      ) : !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">در این پروژه اسپرینت فعالی وجود ندارد. برای نمایش برد، ابتدا یک اسپرینت را شروع کنید.</div>
      )}

      {/* Statistics */}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="تسک‌های قابل مشاهده"
          value={totalTasks}
          icon={<ClipboardList size={19} />}
        />

        <Stat
          label="تسک‌های انجام‌شده"
          value={completedCount}
          icon={<CheckCircle2 size={19} />}
        />

        <div
          className={`${panelClass} p-3`}
          style={{
            borderColor: "var(--border)",
          }}
        >
          <p
            className="text-xs"
            style={{
              color: "var(--muted)",
            }}
          >
            پیشرفت تسک‌های بارگذاری‌شده
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <strong
              className="text-xl font-extrabold"
              style={{
                color: "var(--foreground)",
              }}
            >
              {progress.toLocaleString("fa-IR")}٪
            </strong>

            <span
              className="text-xs"
              style={{
                color: "var(--muted)",
              }}
            >
              براساس وضعیت انجام‌شده
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}

      <div
        className={`${panelClass} p-3`}
        style={{
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Filter
            size={16}
            className="text-emerald-600"
          />

          <h2
            className="text-sm font-bold"
            style={{
              color: "var(--foreground)",
            }}
          >
            فیلترهای برد
          </h2>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{
                color: "var(--muted)",
              }}
            />

            <input
              aria-label="جست‌وجوی تسک"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="جست‌وجوی تسک..."
              className={`${inputClass} pr-9`}
              style={{
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <select
            aria-label="فیلتر اسپرینت"
            value={sprintFilter}
            onChange={(event) =>
              setSprintFilter(
                event.target.value
              )
            }
            className={inputClass}
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="ALL">
              همه اسپرینت‌ها
            </option>

            <option value="BACKLOG">
              خارج از اسپرینت
            </option>

            {sprints.map((sprint) => (
              <option
                key={sprint.id}
                value={sprint.id}
              >
                {sprint.name}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر مسئول"
            value={assigneeFilter}
            onChange={(event) =>
              setAssigneeFilter(
                event.target.value
              )
            }
            className={inputClass}
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="ALL">
              همه مسئول‌ها
            </option>

            <option value="UNASSIGNED">
              بدون مسئول
            </option>

            {assignees.map((assignee) => (
              <option
                key={assignee.id}
                value={assignee.id}
              >
                {assignee.name}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر اولویت"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
            className={inputClass}
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <option value="ALL">
              همه اولویت‌ها
            </option>

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
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p
            className="text-xs"
            style={{
              color: "var(--muted)",
            }}
          >
            نمایش{" "}
            {filteredTasks.length.toLocaleString("fa-IR")}
            {" "}تسک از{" "}
            {tasks.length.toLocaleString("fa-IR")}
            {" "}تسک بارگذاری‌شده
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 transition hover:text-emerald-600"
            >
              <X size={14} />
              پاک کردن فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Board */}

      {loading ? (
        <div
          className="flex min-h-72 items-center justify-center gap-3 rounded-3xl border bg-white"
          style={{
            borderColor: "var(--border)",
          }}
        >
          <LoaderCircle
            size={25}
            className="animate-spin text-emerald-600"
          />

          <span
            className="text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            در حال دریافت تسک‌ها...
          </span>
        </div>
      ) : activeSprint ? (
        <>
          <p
            className="text-xs leading-6"
            style={{
              color: "var(--muted)",
            }}
          >
            کارت‌ها را برای تغییر وضعیت بین ستون‌ها جابه‌جا کنید.
          </p>

          <div className="overflow-x-auto pb-3">
            <div className="grid min-w-[960px] grid-cols-4 gap-3">
              {columns.map((column) => {
                const columnTasks =
                  taskGroups[column.id];

                const isOver =
                  dragOverStatus === column.id;

                return (
                  <section
                    key={column.id}
                    aria-label={column.title}
                    onDragOver={(event) =>
                      onDragOver(
                        event,
                        column.id
                      )
                    }
                    onDrop={(event) =>
                      onDrop(
                        event,
                        column.id
                      )
                    }
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node
                        )
                      ) {
                        setDragOverStatus(null);
                      }
                    }}
                    className={`flex min-h-[420px] flex-col rounded-xl border-2 p-2.5 transition-all duration-200 ${
                      isOver
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-emerald-100 bg-white/65"
                    }`}
                  >
                    <div
                      className={`rounded-lg p-2.5 ${column.headerClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                          className={`size-2 rounded-full ${column.dotClass}`}
                          />

                          <h2 className="text-xs font-extrabold">
                            {column.title}
                          </h2>
                        </div>

                        <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-bold">
                          {columnTasks.length.toLocaleString(
                            "fa-IR"
                          )}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] opacity-75">
                        {column.description}
                      </p>
                    </div>

                    <div className="mt-2.5 flex flex-1 flex-col gap-2.5">
                      {columnTasks.length === 0 ? (
                        <div
                          className={`flex min-h-28 items-center justify-center rounded-lg border border-dashed p-3 text-center text-[11px] ${column.emptyBorderClass}`}
                          style={{
                            color: "var(--muted)",
                          }}
                        >
                          {isOver
                            ? "تسک را اینجا رها کنید"
                            : "تسکی در این ستون نیست"}
                        </div>
                      ) : (
                        columnTasks.map((task) => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            sprints={sprints}
                            projectId={projectId}
                            saving={
                              savingTaskId === task.id
                            }
                            locked={
                              Boolean(savingTaskId)
                            }
                            dragging={
                              draggedTaskId === task.id
                            }
                            onDragStart={(event) =>
                              onDragStart(
                                event,
                                task.id
                              )
                            }
                            onDragEnd={onDragEnd}
                          />
                        ))
                      )}

                      {canManage && (
                        <button
                          type="button"
                          disabled={Boolean(savingTaskId)}
                          onClick={() => setQuickTask({ status: column.id })}
                          className="rounded-lg border border-dashed border-emerald-300 bg-white px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          + افزودن تسک در این ستون
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {canManage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-700">
              <strong>مدیریت تسک‌ها:</strong>{" "}
              برای ویرایش عنوان، مسئول، اولویت
              و تاریخ تسک، وارد بخش وظایف پروژه شوید.
              تغییر وضعیت مستقیماً از همین برد
              امکان‌پذیر است.
            </div>
          )}
        </>
      ) : null}
      {quickTask && (
        <TaskFormModal
          title={`ایجاد تسک در ستون «${statusLabels[quickTask.status]}»`}
          submitLabel="ایجاد و افزودن به برد"
          assignees={[]}
          epics={[]}
          milestones={milestones}
          parentTasks={[]}
          dependencyTasks={tasks.map((task) => ({ id: task.id, title: task.title, status: task.status }))}
          onClose={() => setQuickTask(null)}
          onSubmit={createQuickTask}
        />
      )}
    </div>
  );
}

function KanbanCard({
  task,
  sprints,
  projectId,
  saving,
  locked,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: KanbanTask;
  sprints: Sprint[];
  projectId: string;
  saving: boolean;
  locked: boolean;
  dragging: boolean;
  onDragStart: (
    event: DragEvent<HTMLElement>
  ) => void;
  onDragEnd: () => void;
}) {
  const sprintName =
    sprints.find(
      (sprint) => sprint.id === task.sprintId
    )?.name ?? null;

  return (
    <article
      draggable={!locked}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-white p-3 shadow-sm transition-all duration-200 ${
        dragging
          ? "scale-[0.98] border-emerald-300 opacity-40"
          : "hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
      } ${
        locked
          ? "cursor-default"
          : "cursor-grab active:cursor-grabbing"
      }`}
      style={{
        borderColor: dragging
          ? "var(--primary-border)"
          : "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${priorityStyles[task.priority]}`}
        >
          اولویت {priorityLabels[task.priority]}
        </span>

        <div
          className="flex items-center gap-1"
          style={{
            color: "var(--muted)",
          }}
        >
          {saving ? (
            <LoaderCircle
              size={14}
              className="animate-spin text-emerald-600"
            />
          ) : (
            <GripVertical
              size={15}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <h3
        className="mt-3 break-words text-sm font-bold leading-6"
        style={{
          color: "var(--foreground)",
        }}
      >
        {task.title}
      </h3>

      {task.description && (
        <p
          className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5"
          style={{
            color: "var(--muted)",
          }}
        >
          {task.description}
        </p>
      )}

      {sprintName && (
        <div className="mt-3">
          <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
            <Layers3
              size={12}
              className="shrink-0"
            />

            <span className="truncate">
              {sprintName}
            </span>
          </span>
        </div>
      )}

      <div
        className="mt-3 space-y-1.5 border-t pt-2"
        style={{
          borderColor: "var(--border)",
        }}
      >
        <div
          className="flex items-center gap-1.5 text-[11px]"
          style={{
            color: "var(--muted)",
          }}
        >
          <UserRound
            size={13}
            className="shrink-0"
          />

          <span className="truncate">
            {task.assignee?.name ??
              "بدون مسئول"}
          </span>
        </div>

        {task.dueDate && (
          <div
            className="flex items-center gap-1.5 text-[11px]"
            style={{
              color: "var(--muted)",
            }}
          >
            <CalendarDays
              size={13}
              className="shrink-0"
            />

            <span>
              مهلت: {displayDate(task.dueDate)}
            </span>
          </div>
        )}
      </div>

      <Link
        href={`/projects/${projectId}/sprints`}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 transition hover:text-emerald-600"
      >
        مشاهده وظایف
        <ArrowLeft size={12} />
      </Link>
    </article>
  );
}

function SprintMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-24 rounded-lg border border-emerald-100 bg-white/90 px-2 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-extrabold text-slate-800">{value}</p>
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
  icon: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border bg-white p-3 shadow-sm"
      style={{
        borderColor: "var(--border)",
      }}
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <div>
        <p
          className="text-xs"
          style={{
            color: "var(--muted)",
          }}
        >
          {label}
        </p>

        <p
          className="mt-1 text-xl font-extrabold"
          style={{
            color: "var(--foreground)",
          }}
        >
          {value.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}
