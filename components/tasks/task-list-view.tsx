
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  CircleDashed,
  ClipboardList,
  Filter,
  Flag,
  LayoutList,
  ListTodo,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  UserRound,
  X,
} from "lucide-react";

import ProjectTasks from "@/components/tasks/project-tasks";
import { isoToJalali } from "@/lib/jalali";

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

type Status =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

type Priority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

type Member = {
  role: "MANAGER" | "MEMBER";
  user: {
    id: string;
    name: string;
    role: Role;
  };
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string;
  } | null;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  sprintId?: string | null;
};

type Props = {
  projectId: string;
  projectName: string;
  actorRole: Role;
  canManage: boolean;
  members: Member[];
};

const statusOptions: {
  value: Status;
  label: string;
  dot: string;
  background: string;
}[] = [
  {
    value: "TODO",
    label: "برای انجام",
    dot: "bg-slate-400",
    background: "bg-slate-100 text-slate-700",
  },
  {
    value: "IN_PROGRESS",
    label: "در حال انجام",
    dot: "bg-sky-500",
    background: "bg-sky-50 text-sky-700",
  },
  {
    value: "IN_REVIEW",
    label: "در حال بررسی",
    dot: "bg-amber-500",
    background: "bg-amber-50 text-amber-700",
  },
  {
    value: "DONE",
    label: "انجام‌شده",
    dot: "bg-emerald-500",
    background: "bg-emerald-100 text-emerald-700",
  },
];

const priorityLabels: Record<Priority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const priorityStyles: Record<Priority, string> = {
  LOW: "text-slate-500",
  MEDIUM: "text-sky-600",
  HIGH: "text-amber-600",
  URGENT: "text-rose-600",
};

const inputClass =
  "h-10 w-full rounded-xl border bg-white px-3 text-xs " +
  "outline-none transition focus:border-emerald-500 " +
  "focus:ring-4 focus:ring-emerald-500/10";

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}

function dateLabel(date: string | null) {
  if (!date) return "بدون تاریخ";

  const raw = date.slice(0, 10);
  return isoToJalali(raw) || raw;
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "DONE") {
    return false;
  }

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return task.dueDate.slice(0, 10) < localToday;
}

async function taskRequest(
  taskId: string,
  body: unknown
) {
  const response = await fetch(
    `/api/v1/tasks/${taskId}`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "ذخیره تغییرات ناموفق بود."
    );
  }

  return data;
}

export default function TaskListView({
  projectId,
  projectName,
  actorRole,
  canManage,
  members,
}: Props) {
  const [view, setView] = useState<
    "LIST" | "MANAGE"
  >("LIST");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] =
    useState("ALL");
  const [assigneeFilter, setAssigneeFilter] =
    useState("ALL");

  const [collapsed, setCollapsed] = useState<
    Status[]
  >([]);

  const [selected, setSelected] = useState<string[]>(
    []
  );

  const [bulkStatus, setBulkStatus] =
    useState<Status>("IN_PROGRESS");

  const loadTasks = useCallback(async () => {
    const response = await fetch(
      `/api/v1/projects/${projectId}/tasks`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "دریافت وظایف ناموفق بود."
      );
    }

    setTasks(data.tasks ?? []);
  }, [projectId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await loadTasks();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [loadTasks]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();

    for (const task of tasks) {
      if (task.assignee) {
        map.set(task.assignee.id, task.assignee.name);
      }
    }

    return Array.from(map, ([id, name]) => ({
      id,
      name,
    })).sort((a, b) =>
      a.name.localeCompare(b.name, "fa")
    );
  }, [tasks]);

  const eligibleMembers = useMemo(() => {
    return members.filter((member) => {
      if (
        member.role === "MEMBER" &&
        member.user.role === "EMPLOYEE"
      ) {
        return true;
      }

      return (
        actorRole === "ADMIN" &&
        member.role === "MANAGER" &&
        member.user.role === "MANAGER"
      );
    });
  }, [members, actorRole]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "")
          .toLowerCase()
          .includes(q) ||
        (task.assignee?.name ?? "")
          .toLowerCase()
          .includes(q);

      const matchesPriority =
        priorityFilter === "ALL" ||
        priorityFilter === task.priority;

      const matchesAssignee =
        assigneeFilter === "ALL" ||
        (assigneeFilter === "UNASSIGNED"
          ? task.assigneeId === null
          : task.assigneeId === assigneeFilter);

      return (
        matchesSearch &&
        matchesPriority &&
        matchesAssignee
      );
    });
  }, [
    tasks,
    search,
    priorityFilter,
    assigneeFilter,
  ]);

  const selectedTasks = tasks.filter((task) =>
    selected.includes(task.id)
  );

  const completed = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const overdue = tasks.filter(isOverdue).length;

  function toggleSelected(taskId: string) {
    setSelected((previous) =>
      previous.includes(taskId)
        ? previous.filter((id) => id !== taskId)
        : [...previous, taskId]
    );
  }

  function toggleGroup(status: Status) {
    setCollapsed((previous) =>
      previous.includes(status)
        ? previous.filter((item) => item !== status)
        : [...previous, status]
    );
  }

  function toggleGroupSelection(groupTasks: Task[]) {
    const ids = groupTasks.map((task) => task.id);

    const allSelected =
      ids.length > 0 &&
      ids.every((id) => selected.includes(id));

    setSelected((previous) =>
      allSelected
        ? previous.filter((id) => !ids.includes(id))
        : Array.from(new Set([...previous, ...ids]))
    );
  }

  async function updateStatus(
    task: Task,
    status: Status
  ) {
    if (busy || task.status === status) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await taskRequest(task.id, { status });

      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id
            ? { ...item, status }
            : item
        )
      );

      setNotice("وضعیت تسک ذخیره شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateAssignee(
    task: Task,
    assigneeId: string | null
  ) {
    if (
      !canManage ||
      busy ||
      task.assigneeId === assigneeId
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await taskRequest(task.id, {
        assigneeId,
        note: "",
      });

      await loadTasks();

      setNotice("مسئول وظیفه تغییر کرد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function updatePriority(
    task: Task,
    priority: Priority
  ) {
    if (
      !canManage ||
      busy ||
      task.priority === priority
    ) {
      return;
    }

    // Full-edit API requires the task's dates.
    // Avoid accidentally clearing dates if they
    // were omitted from the list API response.
    if (
      !Object.hasOwn(task, "startDate") ||
      !Object.hasOwn(task, "dueDate")
    ) {
      setError(
        "اطلاعات تاریخ این تسک کامل نیست. اولویت را از بخش مدیریت کامل ویرایش کنید."
      );
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await taskRequest(task.id, {
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority,
        assigneeId: task.assigneeId,
        startDate: task.startDate?.slice(0, 10) ?? null,
        dueDate: task.dueDate?.slice(0, 10) ?? null,
        note: "",
      });

      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id
            ? { ...item, priority }
            : item
        )
      );

      setNotice("اولویت تسک ذخیره شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkStatus() {
    if (
      busy ||
      selectedTasks.length === 0
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    let successCount = 0;
    const failures: string[] = [];

    for (const task of selectedTasks) {
      if (task.status === bulkStatus) {
        successCount++;
        continue;
      }

      try {
        await taskRequest(task.id, {
          status: bulkStatus,
        });

        successCount++;

        setTasks((previous) =>
          previous.map((item) =>
            item.id === task.id
              ? { ...item, status: bulkStatus }
              : item
          )
        );
      } catch (error) {
        failures.push(
          `${task.title}: ${messageOf(error)}`
        );
      }
    }

    if (failures.length > 0) {
      setError(
        `${failures.length.toLocaleString("fa-IR")} تسک تغییر نکرد. ${failures.slice(0, 3).join(" | ")}`
      );
    }

    if (successCount > 0) {
      setNotice(
        `وضعیت ${successCount.toLocaleString("fa-IR")} تسک بررسی و ثبت شد.`
      );
    }

    setSelected([]);
    setBusy(false);
  }

  return (
    <div
      dir="rtl"
      className="space-y-6"
      style={{
        color: "var(--foreground)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 items-center justify-center rounded-2xl text-white"
              style={{
                background: "var(--primary)",
              }}
            >
              <ListTodo size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold">
                وظایف پروژه
              </h1>

              <p
                className="mt-1 text-sm"
                style={{
                  color: "var(--muted)",
                }}
              >
                {projectName}
              </p>
            </div>
          </div>

          <p
            className="mt-4 text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            مدیریت وظایف در قالب لیست گروه‌بندی‌شده
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-xs font-semibold transition hover:bg-emerald-50"
            style={{
              borderColor: "var(--border)",
            }}
          >
            <ArrowRight size={15} />
            بازگشت
          </Link>

          <button
            type="button"
            onClick={() => {
              setView("LIST");
              void refresh();
            }}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
              view === "LIST"
                ? "bg-emerald-600 text-white"
                : "border border-emerald-200 bg-white text-emerald-700"
            }`}
          >
            <LayoutList size={17} />
            نمای لیستی
          </button>

          <button
            type="button"
            onClick={() => setView("MANAGE")}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
              view === "MANAGE"
                ? "bg-emerald-600 text-white"
                : "border border-emerald-200 bg-white text-emerald-700"
            }`}
          >
            <Settings2 size={17} />
            مدیریت کامل
          </button>
        </div>
      </div>

      {view === "MANAGE" ? (
        <ProjectTasks
          projectId={projectId}
          members={members}
          canManage={canManage}
          actorRole={actorRole}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              title="کل وظایف"
              count={tasks.length}
              icon={<ClipboardList size={19} />}
            />
            <SummaryCard
              title="تکمیل‌شده"
              count={completed}
              icon={<CheckCheck size={19} />}
            />
            <SummaryCard
              title="از موعد گذشته"
              count={overdue}
              icon={<CalendarDays size={19} />}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              {notice}
            </div>
          )}

          <div
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            style={{
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Filter
                  size={17}
                  className="text-emerald-600"
                />
                <h2 className="text-sm font-bold">
                  فیلترها
                </h2>
              </div>

              <button
                type="button"
                disabled={loading || busy}
                onClick={() => void refresh()}
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={
                    loading ? "animate-spin" : ""
                  }
                />
                به‌روزرسانی
              </button>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className={`${inputClass} pr-10`}
                  style={{
                    borderColor: "var(--border)",
                  }}
                  placeholder="جست‌وجو در تسک‌ها..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                aria-label="فیلتر مسئول"
                className={inputClass}
                style={{
                  borderColor: "var(--border)",
                }}
                value={assigneeFilter}
                onChange={(event) =>
                  setAssigneeFilter(event.target.value)
                }
              >
                <option value="ALL">
                  همه مسئول‌ها
                </option>
                <option value="UNASSIGNED">
                  بدون مسئول
                </option>
                {assignees.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="فیلتر اولویت"
                className={inputClass}
                style={{
                  borderColor: "var(--border)",
                }}
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value)
                }
              >
                <option value="ALL">
                  همه اولویت‌ها
                </option>
                {Object.entries(
                  priorityLabels
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <span className="text-xs font-bold text-emerald-800">
                {selected.length.toLocaleString("fa-IR")} تسک انتخاب‌شده
              </span>

              <select
                aria-label="وضعیت گروهی"
                value={bulkStatus}
                disabled={busy}
                onChange={(event) =>
                  setBulkStatus(
                    event.target.value as Status
                  )
                }
                className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-xs outline-none"
              >
                {statusOptions.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void applyBulkStatus()
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Check size={15} />
                )}
                اعمال وضعیت
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected([])}
                className="mr-auto inline-flex items-center gap-1 text-xs text-emerald-700 disabled:opacity-50"
              >
                <X size={15} />
                لغو انتخاب
              </button>
            </div>
          )}

          <div
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            style={{
              borderColor: "var(--border)",
            }}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[minmax(320px,1fr)_180px_145px_145px] gap-4 border-b border-emerald-100 bg-emerald-50/50 px-5 py-4 text-xs font-semibold text-slate-500">
                  <span>نام وظیفه</span>
                  <span>مسئول</span>
                  <span>تاریخ سررسید</span>
                  <span>اولویت</span>
                </div>

                {loading ? (
                  <div className="flex justify-center py-16">
                    <LoaderCircle
                      size={27}
                      className="animate-spin text-emerald-600"
                    />
                  </div>
                ) : (
                  statusOptions.map((group) => {
                    const groupTasks =
                      filteredTasks.filter(
                        (task) =>
                          task.status === group.value
                      );

                    const isCollapsed =
                      collapsed.includes(group.value);

                    const allSelected =
                      groupTasks.length > 0 &&
                      groupTasks.every((task) =>
                        selected.includes(task.id)
                      );

                    return (
                      <section key={group.value}>
                        <div className="flex items-center gap-3 border-b border-emerald-100 bg-[#fbfdfb] px-5 py-3">
                          <button
                            type="button"
                            aria-label={
                              isCollapsed
                                ? "باز کردن گروه"
                                : "بستن گروه"
                            }
                            onClick={() =>
                              toggleGroup(group.value)
                            }
                            className="rounded p-1 hover:bg-emerald-50"
                          >
                            {isCollapsed ? (
                              <ChevronLeft size={17} />
                            ) : (
                              <ChevronDown size={17} />
                            )}
                          </button>

                          <input
                            type="checkbox"
                            aria-label={`انتخاب همه تسک‌های ${group.label}`}
                            checked={allSelected}
                            disabled={
                              busy ||
                              groupTasks.length === 0
                            }
                            onChange={() =>
                              toggleGroupSelection(
                                groupTasks
                              )
                            }
                            className="size-4 accent-emerald-600"
                          />

                          <span
                            className={`size-2.5 rounded-full ${group.dot}`}
                          />

                          <span className="text-sm font-extrabold">
                            {group.label}
                          </span>

                          <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            {groupTasks.length.toLocaleString(
                              "fa-IR"
                            )}
                          </span>
                        </div>

                        {!isCollapsed &&
                          groupTasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              selected={selected.includes(
                                task.id
                              )}
                              busy={busy}
                              canManage={canManage}
                              eligibleMembers={
                                eligibleMembers
                              }
                              onSelect={() =>
                                toggleSelected(task.id)
                              }
                              onStatusChange={(status) =>
                                void updateStatus(
                                  task,
                                  status
                                )
                              }
                              onPriorityChange={(
                                priority
                              ) =>
                                void updatePriority(
                                  task,
                                  priority
                                )
                              }
                              onAssigneeChange={(
                                assigneeId
                              ) =>
                                void updateAssignee(
                                  task,
                                  assigneeId
                                )
                              }
                            />
                          ))}
                      </section>
                    );
                  })
                )}

                {!loading &&
                  filteredTasks.length === 0 && (
                    <div className="py-14 text-center">
                      <CircleDashed
                        size={30}
                        className="mx-auto text-emerald-300"
                      />
                      <p className="mt-3 text-sm text-slate-500">
                        وظیفه‌ای مطابق فیلترها پیدا نشد.
                      </p>
                    </div>
                  )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 px-5 py-4">
              <span className="text-xs text-slate-500">
                {filteredTasks.length.toLocaleString(
                  "fa-IR"
                )}{" "}
                وظیفه در لیست
              </span>

              <button
                type="button"
                onClick={() => setView("MANAGE")}
                className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700"
              >
                {canManage ? (
                  <Plus size={16} />
                ) : (
                  <MessageSquareText size={16} />
                )}
                {canManage
                  ? "افزودن و مدیریت کامل وظایف"
                  : "مشاهده جزئیات و گفتگوها"}
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TaskRow({
  task,
  selected,
  busy,
  canManage,
  eligibleMembers,
  onSelect,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
}: {
  task: Task;
  selected: boolean;
  busy: boolean;
  canManage: boolean;
  eligibleMembers: Member[];
  onSelect: () => void;
  onStatusChange: (status: Status) => void;
  onPriorityChange: (priority: Priority) => void;
  onAssigneeChange: (
    assigneeId: string | null
  ) => void;
}) {
  const overdue = isOverdue(task);

  const currentAssigneeIsEligible =
    task.assigneeId === null ||
    eligibleMembers.some(
      (member) =>
        member.user.id === task.assigneeId
    );

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_180px_145px_145px] items-center gap-4 border-b border-slate-100 px-5 py-3.5 transition hover:bg-emerald-50/40">
      <div className="flex min-w-0 items-center gap-3">
        <input
          type="checkbox"
          aria-label={`انتخاب ${task.title}`}
          checked={selected}
          disabled={busy}
          onChange={onSelect}
          className="size-4 shrink-0 accent-emerald-600"
        />

        <div className="relative shrink-0">
          <select
            aria-label={`وضعیت ${task.title}`}
            title="تغییر وضعیت"
            disabled={busy}
            value={task.status}
            onChange={(event) =>
              onStatusChange(
                event.target.value as Status
              )
            }
            className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          >
            {statusOptions.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

          {task.status === "DONE" ? (
            <CheckCheck
              size={20}
              className="text-emerald-600"
            />
          ) : (
            <CircleDashed
              size={20}
              className={
                statusOptions.find(
                  (item) =>
                    item.value === task.status
                )?.value === "IN_PROGRESS"
                  ? "text-sky-500"
                  : task.status === "IN_REVIEW"
                    ? "text-amber-500"
                    : "text-slate-400"
              }
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {task.title}
          </p>

          {task.description && (
            <p className="mt-1 truncate text-xs text-slate-400">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {canManage ? (
          <select
            aria-label={`مسئول ${task.title}`}
            value={task.assigneeId ?? ""}
            disabled={busy}
            onChange={(event) =>
              onAssigneeChange(
                event.target.value || null
              )
            }
            className="w-full truncate rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs text-slate-700 outline-none transition hover:border-emerald-200 hover:bg-white focus:border-emerald-400"
          >
            <option value="">بدون مسئول</option>

            {!currentAssigneeIsEligible &&
              task.assigneeId && (
                <option value={task.assigneeId}>
                  {task.assignee?.name ??
                    "مسئول فعلی"}
                </option>
              )}

            {eligibleMembers.map((member) => (
              <option
                key={member.user.id}
                value={member.user.id}
              >
                {member.user.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <UserRound
              size={16}
              className="text-emerald-600"
            />
            <span className="truncate">
              {task.assignee?.name ??
                "بدون مسئول"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <CalendarDays
          size={15}
          className={
            overdue
              ? "text-rose-500"
              : "text-slate-400"
          }
        />

        <span
          className={`whitespace-nowrap text-xs ${
            overdue
              ? "font-semibold text-rose-600"
              : "text-slate-600"
          }`}
        >
          {dateLabel(task.dueDate)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Flag
          size={15}
          className={priorityStyles[task.priority]}
        />

        {canManage ? (
          <select
            aria-label={`اولویت ${task.title}`}
            value={task.priority}
            disabled={busy}
            onChange={(event) =>
              onPriorityChange(
                event.target.value as Priority
              )
            }
            className={`w-full rounded-lg border border-transparent bg-transparent px-1 py-2 text-xs font-semibold outline-none transition hover:border-emerald-200 hover:bg-white ${priorityStyles[task.priority]}`}
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
        ) : (
          <span
            className={`text-xs font-semibold ${priorityStyles[task.priority]}`}
          >
            {priorityLabels[task.priority]}
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  count,
  icon,
}: {
  title: string;
  count: number;
  icon: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"
      style={{
        borderColor: "var(--border)",
      }}
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <div>
        <p
          className="text-xs"
          style={{ color: "var(--muted)" }}
        >
          {title}
        </p>

        <p className="mt-1 text-xl font-extrabold">
          {count.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}
