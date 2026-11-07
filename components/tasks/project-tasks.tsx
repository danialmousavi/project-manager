
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  History,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import PersianDatePicker from "@/components/ui/persian-date-picker";
import ConfirmDialog from "@/components/ui/confirm-dialog";
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
  _count: {
    comments: number;
  };
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
};

type FieldName =
  | "title"
  | "description"
  | "priority"
  | "status"
  | "startDate"
  | "dueDate";

type HistoryItem = {
  id: string;
  type: "ASSIGNMENT" | "EDIT";
  fromUserName: string | null;
  toUserName: string | null;
  note: string;
  changes: {
    field: FieldName;
    from: string | null;
    to: string | null;
  }[];
  createdAt: string;
  changedBy: {
    name: string;
  };
};

type Props = {
  projectId: string;
  members: Member[];
  canManage: boolean;
  actorRole: Role;
};

const statusLabels: Record<Status, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در حال بررسی",
  DONE: "انجام‌شده",
};

const priorityLabels: Record<Priority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const fieldLabels: Record<FieldName, string> = {
  title: "عنوان",
  description: "توضیحات",
  priority: "اولویت",
  status: "وضعیت",
  startDate: "تاریخ شروع",
  dueDate: "تاریخ پایان",
};

const statusColors: Record<Status, string> = {
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

const priorityColors: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-50 text-orange-700",
  URGENT: "bg-rose-50 text-rose-700",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60";

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}

function getFieldValue(
  field: FieldName,
  value: string | null
) {
  if (!value) return "خالی";

  if (field === "priority") {
    return priorityLabels[value as Priority] ?? value;
  }

  if (field === "status") {
    return statusLabels[value as Status] ?? value;
  }

  if (field === "startDate" || field === "dueDate") {
    return isoToJalali(value) || value;
  }

  return value;
}

async function sendApi(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "درخواست ناموفق بود."
    );
  }

  return data;
}

export default function ProjectTasks({
  projectId,
  members,
  canManage,
  actorRole,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] =
    useState<Task | null>(null);
  const [deleteId, setDeleteId] =
    useState<string | null>(null);

  const [activeTaskId, setActiveTaskId] =
    useState<string | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);
  const [history, setHistory] =
    useState<HistoryItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");

  const activeTask = tasks.find(
    (task) => task.id === activeTaskId
  );

  const assignees = members.filter(
    (member) =>
      (member.role === "MEMBER" &&
        member.user.role === "EMPLOYEE") ||
      (actorRole === "ADMIN" &&
        member.role === "MANAGER" &&
        member.user.role === "MANAGER")
  );

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/tasks`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت وظایف ناموفق بود."
        );
      }

      setTasks(data.tasks ?? []);
      const taskId = window.location.hash.match(/^#task-([0-9a-f-]{36})$/i)?.[1];
      if (taskId && data.tasks?.some((task: Task) => task.id === taskId)) {
        window.setTimeout(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ block: "center" }), 0);
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  async function changeStatus(
    task: Task,
    nextStatus: Status
  ) {
    if (busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await sendApi(
        `/api/v1/tasks/${task.id}`,
        "PATCH",
        { status: nextStatus }
      );

      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id
            ? { ...item, status: nextStatus }
            : item
        )
      );

      setNotice("وضعیت تسک ثبت شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function openDetails(task: Task) {
    if (activeTaskId === task.id) {
      setActiveTaskId(null);
      return;
    }

    setActiveTaskId(task.id);
    setNewAssigneeId(task.assigneeId ?? "");
    setAssignmentNote("");
    setComments([]);
    setHistory([]);
    setCommentText("");
    setDetailLoading(true);
    setError("");

    try {
      const urls = [
        `/api/v1/tasks/${task.id}/comments`,
        ...(canManage
          ? [`/api/v1/tasks/${task.id}/history`]
          : []),
      ];

      const responses = await Promise.all(
        urls.map((url) =>
          fetch(url, { cache: "no-store" })
        )
      );

      const payloads = await Promise.all(
        responses.map((response) => response.json())
      );

      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          throw new Error(
            payloads[i].message ||
              "دریافت جزئیات ناموفق بود."
          );
        }
      }

      setComments(payloads[0].comments ?? []);

      if (canManage) {
        setHistory(payloads[1].history ?? []);
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetails(taskId: string) {
    if (!canManage) return;

    const response = await fetch(
      `/api/v1/tasks/${taskId}/history`,
      { cache: "no-store" }
    );

    if (response.ok) {
      const data = await response.json();
      setHistory(data.history ?? []);
    }
  }

  async function saveAssignment() {
    if (!activeTask || !canManage || busy) return;

    const taskId = activeTask.id;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await sendApi(
        `/api/v1/tasks/${taskId}`,
        "PATCH",
        {
          assigneeId: newAssigneeId || null,
          note: assignmentNote,
        }
      );

      await loadTasks();
      await refreshDetails(taskId);
      setAssignmentNote("");
      setNotice("واگذاری تسک ثبت شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function addComment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !activeTask ||
      busy ||
      !commentText.trim()
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const data = await sendApi(
        `/api/v1/tasks/${activeTask.id}/comments`,
        "POST",
        { content: commentText }
      );

      setComments((previous) => [
        ...previous,
        data.comment,
      ]);

      setCommentText("");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeTask() {
    if (
      !deleteId ||
      busy ||
      actorRole !== "ADMIN"
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await sendApi(
        `/api/v1/tasks/${deleteId}`,
        "DELETE"
      );

      setTasks((previous) =>
        previous.filter((task) => task.id !== deleteId)
      );

      if (activeTaskId === deleteId) {
        setActiveTaskId(null);
      }

      setDeleteId(null);
      setNotice("تسک حذف شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const q = query.trim().toLowerCase();

    return (
      (task.title.toLowerCase().includes(q) ||
        (task.description ?? "")
          .toLowerCase()
          .includes(q)) &&
      (filter === "ALL" || task.status === filter)
    );
  });

  const doneCount = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const doingCount = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <ClipboardList
              size={23}
              className="text-emerald-600"
            />
            مدیریت وظایف
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            ساخت، ویرایش، واگذاری و پیگیری فعالیت‌ها
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            وظیفه جدید
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="کل وظایف"
          value={tasks.length}
          icon={<ClipboardList size={18} />}
        />
        <MiniStat
          label="در حال انجام"
          value={doingCount}
          icon={<Clock3 size={18} />}
        />
        <MiniStat
          label="تکمیل‌شده"
          value={doneCount}
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
            aria-label="جست‌وجو در وظایف"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="جست‌وجو در وظایف..."
            className={`${inputClass} pr-10`}
          />
        </div>

        <select
          aria-label="فیلتر وضعیت تسک"
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value)
          }
          className={`${inputClass} sm:w-44`}
        >
          <option value="ALL">همه وضعیت‌ها</option>

          {Object.entries(statusLabels).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-14">
            <LoaderCircle
              size={25}
              className="animate-spin text-emerald-600"
            />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
            <ClipboardList
              size={34}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm text-slate-500">
              وظیفه‌ای برای نمایش وجود ندارد.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const expanded =
              activeTaskId === task.id;

            return (
              <article
                key={task.id}
                id={`task-${task.id}`}
                className={`overflow-hidden rounded-2xl border transition ${
                  expanded
                    ? "border-emerald-300 shadow-md"
                    : "border-slate-200 hover:border-emerald-200"
                }`}
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      void openDetails(task)
                    }
                    className="min-h-11 min-w-0 flex-1 text-right"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        size={17}
                        className={`text-slate-400 transition ${
                          expanded
                            ? "rotate-180"
                            : ""
                        }`}
                      />

                      <h3 className="font-bold text-slate-900">
                        {task.title}
                      </h3>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={14} />
                        {task.assignee?.name ||
                          "بدون مسئول"}
                      </span>

                      {task.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={14} />
                          {isoToJalali(
                            task.dueDate
                          )}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={14} />
                        گفتگوها
                      </span>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg px-3 py-2 text-xs ${priorityColors[task.priority]}`}
                    >
                      {priorityLabels[task.priority]}
                    </span>

                    <select
                      aria-label={`وضعیت ${task.title}`}
                      value={task.status}
                      disabled={busy}
                      onChange={(event) =>
                        void changeStatus(
                          task,
                          event.target.value as Status
                        )
                      }
                      className={`rounded-lg border-0 px-3 py-2 text-xs font-semibold outline-none disabled:opacity-50 ${statusColors[task.status]}`}
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

                    {canManage && (
                      <button
                        type="button"
                        title="ویرایش وظیفه"
                        aria-label={`ویرایش ${task.title}`}
                        onClick={() =>
                          setEditingTask(task)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
                      >
                        <Pencil size={15} />
                        ویرایش
                      </button>
                    )}

                    {actorRole === "ADMIN" && (
                      <button
                        type="button"
                        title="حذف وظیفه"
                        aria-label={`حذف ${task.title}`}
                        onClick={() =>
                          setDeleteId(task.id)
                        }
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                    {detailLoading ? (
                      <div className="flex justify-center py-8">
                        <LoaderCircle
                          size={22}
                          className="animate-spin text-emerald-600"
                        />
                      </div>
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-5">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              جزئیات وظیفه
                            </h4>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                              {task.description ||
                                "توضیحی ثبت نشده است."}
                            </p>

                            {task.startDate && (
                              <p className="mt-3 text-xs text-slate-500">
                                شروع:{" "}
                                {isoToJalali(
                                  task.startDate
                                )}
                              </p>
                            )}
                          </div>

                          {canManage && (
                            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                              <h4 className="flex items-center gap-2 text-sm font-bold">
                                <ArrowLeftRight
                                  size={17}
                                  className="text-emerald-600"
                                />
                                واگذاری سریع
                              </h4>

                              <select
                                className={inputClass}
                                value={newAssigneeId}
                                onChange={(event) =>
                                  setNewAssigneeId(
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">
                                  بدون مسئول
                                </option>

                                {activeTask?.assigneeId &&
                                  !assignees.some(
                                    (member) =>
                                      member.user.id ===
                                      activeTask.assigneeId
                                  ) && (
                                    <option
                                      value={
                                        activeTask.assigneeId
                                      }
                                    >
                                      {activeTask.assignee
                                        ?.name ??
                                        "مسئول فعلی"}
                                      {" — مسئول فعلی"}
                                    </option>
                                  )}

                                {assignees.map(
                                  (member) => (
                                    <option
                                      key={member.user.id}
                                      value={member.user.id}
                                    >
                                      {member.user.name}
                                      {member.role ===
                                      "MANAGER"
                                        ? " — مدیر پروژه"
                                        : ""}
                                    </option>
                                  )
                                )}
                              </select>

                              <textarea
                                className={inputClass}
                                rows={2}
                                maxLength={500}
                                value={assignmentNote}
                                onChange={(event) =>
                                  setAssignmentNote(
                                    event.target.value
                                  )
                                }
                                placeholder="دلیل واگذاری (اختیاری)"
                              />

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void saveAssignment()
                                }
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                ثبت واگذاری
                              </button>
                            </div>
                          )}

                          {canManage && (
                            <div className="space-y-3">
                              <h4 className="flex items-center gap-2 font-bold text-slate-900">
                                <History size={17} />
                                تاریخچه فعالیت‌ها
                              </h4>

                              {history.length === 0 && (
                                <p className="text-sm text-slate-400">
                                  هنوز تغییری ثبت نشده
                                  است.
                                </p>
                              )}

                              {history.map((entry) => (
                                <HistoryCard
                                  key={entry.id}
                                  item={entry}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 font-bold text-slate-900">
                            <MessageCircle
                              size={18}
                              className="text-emerald-600"
                            />
                            گفتگوهای تسک
                          </h4>

                          <div className="max-h-80 space-y-3 overflow-y-auto">
                            {comments.length === 0 && (
                              <p className="text-sm text-slate-400">
                                هنوز کامنتی ثبت نشده
                                است.
                              </p>
                            )}

                            {comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="rounded-xl bg-white p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="text-xs text-slate-800">
                                    {comment.author.name}
                                  </strong>

                                  <span className="text-xs text-slate-400">
                                    {new Date(
                                      comment.createdAt
                                    ).toLocaleString(
                                      "fa-IR"
                                    )}
                                  </span>
                                </div>

                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                                  {comment.content}
                                </p>
                              </div>
                            ))}
                          </div>

                          <form
                            onSubmit={addComment}
                            className="space-y-3"
                          >
                            <textarea
                              className={inputClass}
                              required
                              rows={3}
                              maxLength={2000}
                              value={commentText}
                              onChange={(event) =>
                                setCommentText(
                                  event.target.value
                                )
                              }
                              placeholder="پیام خود را بنویسید..."
                            />

                            <button
                              type="submit"
                              disabled={
                                busy ||
                                !commentText.trim()
                              }
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              <Send size={15} />
                              ثبت کامنت
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {creating && (
        <TaskFormModal
          title="ایجاد وظیفه جدید"
          submitLabel="ثبت وظیفه"
          assignees={assignees}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const data = await sendApi(
              `/api/v1/projects/${projectId}/tasks`,
              "POST",
              {
                title: values.title,
                description: values.description,
                status: values.status,
                priority: values.priority,
                assigneeId: values.assigneeId,
                startDate: values.startDate,
                dueDate: values.dueDate,
              }
            );

            setTasks((previous) => [
              data.task,
              ...previous,
            ]);

            setCreating(false);
            setNotice("وظیفه جدید ایجاد شد.");
          }}
        />
      )}

      {editingTask && (
        <TaskFormModal
          key={editingTask.id}
          title="ویرایش وظیفه"
          submitLabel="ذخیره تغییرات"
          task={editingTask}
          assignees={assignees}
          onClose={() => setEditingTask(null)}
          onSubmit={async (values) => {
            const taskId = editingTask.id;

            await sendApi(
              `/api/v1/tasks/${taskId}`,
              "PATCH",
              values
            );

            setEditingTask(null);
            setNotice("اطلاعات تسک به‌روزرسانی شد.");

            await loadTasks();

            if (activeTaskId === taskId) {
              await refreshDetails(taskId);
            }
          }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          title="حذف وظیفه"
          description="این وظیفه همراه با گفتگوها و تاریخچه آن برای همیشه حذف خواهد شد. آیا مطمئن هستید؟"
          busy={busy}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void removeTask()}
        />
      )}
    </section>
  );
}

type FormValues = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  note: string;
};

function TaskFormModal({
  title: modalTitle,
  submitLabel,
  task,
  assignees,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  task?: Task;
  assignees: Member[];
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(
    task?.description ?? ""
  );
  const [status, setStatus] = useState<Status>(
    task?.status ?? "TODO"
  );
  const [priority, setPriority] = useState<Priority>(
    task?.priority ?? "MEDIUM"
  );
  const [assigneeId, setAssigneeId] = useState(
    task?.assigneeId ?? ""
  );

  const [startDate, setStartDate] = useState<
    string | null
  >(task?.startDate?.slice(0, 10) ?? null);

  const [dueDate, setDueDate] = useState<
    string | null
  >(task?.dueDate?.slice(0, 10) ?? null);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    if (
      startDate &&
      dueDate &&
      startDate > dueDate
    ) {
      setError(
        "تاریخ پایان نمی‌تواند قبل از شروع باشد."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({
        title,
        description,
        status,
        priority,
        assigneeId: assigneeId || null,
        startDate,
        dueDate,
        note,
      });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2
              id="task-form-title"
              className="text-xl font-extrabold text-slate-900"
            >
              {modalTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              اطلاعات وظیفه و زمان‌بندی را تکمیل کنید.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            aria-label="بستن فرم"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <Field label="عنوان وظیفه">
              <input
                className={inputClass}
                required
                minLength={3}
                maxLength={200}
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="مثلاً طراحی داشبورد"
              />
            </Field>

            <Field label="توضیحات">
              <textarea
                className={inputClass}
                rows={3}
                maxLength={5000}
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="شرح فعالیت و خروجی موردانتظار..."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="مسئول وظیفه">
                <select
                  className={inputClass}
                  value={assigneeId}
                  onChange={(event) =>
                    setAssigneeId(event.target.value)
                  }
                >
                  <option value="">بدون مسئول</option>

                  {task?.assigneeId &&
                    !assignees.some(
                      (member) =>
                        member.user.id === task.assigneeId
                    ) && (
                      <option value={task.assigneeId}>
                        {task.assignee?.name ??
                          "مسئول فعلی"}
                        {" — مسئول فعلی"}
                      </option>
                    )}

                  {assignees.map((member) => (
                    <option
                      key={member.user.id}
                      value={member.user.id}
                    >
                      {member.user.name}
                      {member.role === "MANAGER"
                        ? " — مدیر پروژه"
                        : ""}
                    </option>
                  ))}
                </select>
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

              <Field label="وضعیت">
                <select
                  className={inputClass}
                  value={status}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PersianDatePicker
                label="تاریخ شروع"
                value={startDate}
                onChange={setStartDate}
              />

              <PersianDatePicker
                label="مهلت انجام"
                value={dueDate}
                onChange={setDueDate}
              />
            </div>

            {task && (
              <Field label="توضیح تغییرات (اختیاری)">
                <textarea
                  className={inputClass}
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder="مثلاً اصلاح زمان‌بندی پس از جلسه تیم"
                />
              </Field>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 disabled:opacity-50"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : task ? (
                <Pencil size={17} />
              ) : (
                <Plus size={17} />
              )}

              {saving
                ? "در حال ذخیره..."
                : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryCard({
  item,
}: {
  item: HistoryItem;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-xs text-slate-800">
          {item.changedBy.name}
        </strong>

        <span className="text-xs text-slate-400">
          {new Date(
            item.createdAt
          ).toLocaleString("fa-IR")}
        </span>
      </div>

      <div className="mt-2">
        <span className="inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          {item.type === "ASSIGNMENT"
            ? "تغییر مسئول"
            : "ویرایش مشخصات"}
        </span>
      </div>

      {item.type === "ASSIGNMENT" ? (
        <p className="mt-3 text-xs leading-7 text-slate-600">
          از{" "}
          <strong>
            {item.fromUserName || "بدون مسئول"}
          </strong>
          {" به "}
          <strong>
            {item.toUserName || "بدون مسئول"}
          </strong>
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {item.changes.map((change, index) => (
            <div
              key={`${change.field}-${index}`}
              className="rounded-lg bg-slate-50 p-3"
            >
              <p className="text-xs font-bold text-slate-700">
                {fieldLabels[change.field]}
              </p>

              <p className="mt-2 break-words text-xs leading-6 text-slate-500">
                قبلی:{" "}
                {getFieldValue(
                  change.field,
                  change.from
                )}
              </p>

              <p className="mt-1 break-words text-xs leading-6 text-emerald-700">
                جدید:{" "}
                {getFieldValue(
                  change.field,
                  change.to
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {item.note && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">
          توضیح: {item.note}
        </p>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white text-emerald-600">
        {icon}
      </div>

      <div>
        <p className="text-xs text-slate-500">
          {label}
        </p>

        <p className="mt-1 text-xl font-bold text-slate-900">
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
