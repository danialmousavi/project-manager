
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  History,
  LoaderCircle,
  MessageCircle,
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

type Assignment = {
  id: string;
  fromUserName: string | null;
  toUserName: string | null;
  note: string | null;
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
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}

export default function ProjectTasks({
  projectId,
  members,
  canManage,
  actorRole,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<
    string | null
  >(null);

  const [activeTaskId, setActiveTaskId] = useState<
    string | null
  >(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<Priority>("MEDIUM");
  const [status, setStatus] =
    useState<Status>("TODO");
  const [assigneeId, setAssigneeId] = useState("");

  const [startDate, setStartDate] = useState<
    string | null
  >(null);
  const [dueDate, setDueDate] = useState<
    string | null
  >(null);

  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [assignmentNote, setAssignmentNote] =
    useState("");

  const [history, setHistory] = useState<Assignment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [detailLoading, setDetailLoading] =
    useState(false);

  const activeTask = tasks.find(
    (task) => task.id === activeTaskId
  );

  const assignees = members.filter(
    (member) =>
      (
        member.role === "MEMBER" &&
        member.user.role === "EMPLOYEE"
      ) ||
      (
        actorRole === "ADMIN" &&
        member.role === "MANAGER" &&
        member.user.role === "MANAGER"
      )
  );

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/tasks`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت تسک‌ها ناموفق بود."
        );
      }

      setTasks(data.tasks);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

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

  function resetCreateForm() {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setStatus("TODO");
    setAssigneeId("");
    setStartDate(null);
    setDueDate(null);
  }

  async function createTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManage || busy) return;

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

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const data = await sendApi(
        `/api/v1/projects/${projectId}/tasks`,
        "POST",
        {
          title,
          description,
          priority,
          status,
          assigneeId: assigneeId || null,
          startDate,
          dueDate,
        }
      );

      setTasks((previous) => [
        data.task,
        ...previous,
      ]);

      resetCreateForm();
      setCreating(false);
      setNotice("تسک جدید ایجاد شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(
    task: Task,
    nextStatus: Status
  ) {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await sendApi(
        `/api/v1/tasks/${task.id}`,
        "PATCH",
        { status: nextStatus }
      );

      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );
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
      const requests: Promise<Response>[] = [
        fetch(
          `/api/v1/tasks/${task.id}/comments`,
          { cache: "no-store" }
        ),
      ];

      if (canManage) {
        requests.push(
          fetch(
            `/api/v1/tasks/${task.id}/history`,
            { cache: "no-store" }
          )
        );
      }

      const responses = await Promise.all(requests);
      const payloads = await Promise.all(
        responses.map((response) => response.json())
      );

      for (let index = 0; index < responses.length; index++) {
        if (!responses[index].ok) {
          throw new Error(
            payloads[index].message ||
            "دریافت اطلاعات تسک ناموفق بود."
          );
        }
      }

      setComments(payloads[0].comments);

      if (canManage) {
        setHistory(payloads[1].history);
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveAssignment() {
    if (!activeTask || !canManage || busy) return;

    setBusy(true);
    setError("");

    try {
      await sendApi(
        `/api/v1/tasks/${activeTask.id}`,
        "PATCH",
        {
          assigneeId:
            newAssigneeId || null,
          note: assignmentNote,
        }
      );

      setActiveTaskId(null);
      setNotice("واگذاری تسک ثبت شد.");
      await loadTasks();
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
      !commentText.trim() ||
      busy
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

      setTasks((previous) =>
        previous.map((task) =>
          task.id === activeTask.id
            ? {
                ...task,
                _count: {
                  comments:
                    task._count.comments + 1,
                },
              }
            : task
        )
      );

      setCommentText("");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask() {
    if (
      !deleteId ||
      busy ||
      actorRole !== "ADMIN"
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await sendApi(
        `/api/v1/tasks/${deleteId}`,
        "DELETE"
      );

      setTasks((previous) =>
        previous.filter(
          (task) => task.id !== deleteId
        )
      );

      if (activeTaskId === deleteId) {
        setActiveTaskId(null);
      }

      setDeleteId(null);
      setNotice("تسک حذف شد.");
    } catch (error) {
      setDeleteId(null);
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const searchText = query.trim().toLowerCase();

    const matchesSearch =
      task.title.toLowerCase().includes(searchText) ||
      (task.description ?? "")
        .toLowerCase()
        .includes(searchText);

    const matchesFilter =
      filter === "ALL" || task.status === filter;

    return matchesSearch && matchesFilter;
  });

  const doneCount = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const inProgressCount = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <ClipboardList
              size={23}
              className="text-indigo-600"
            />
            وظایف پروژه
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            مدیریت کارها، واگذاری مسئولیت و گفتگوها
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus size={18} />
            وظیفه جدید
          </button>
        )}
      </div>

      {/* Statistics */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="کل وظایف"
          value={tasks.length}
          icon={<ClipboardList size={18} />}
        />

        <MiniStat
          label="در حال انجام"
          value={inProgressCount}
          icon={<ArrowLeftRight size={18} />}
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

      {/* Filters */}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
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

      {/* Task list */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-14">
            <LoaderCircle
              size={26}
              className="animate-spin text-indigo-600"
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
                className={`overflow-hidden rounded-2xl border bg-white transition ${
                  expanded
                    ? "border-indigo-300 shadow-md"
                    : "border-slate-200 hover:border-indigo-200"
                }`}
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      void openDetails(task)
                    }
                    className="min-w-0 flex-1 text-right"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        size={17}
                        className={`shrink-0 text-slate-400 transition ${
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
                      value={task.status}
                      disabled={busy}
                      aria-label={`وضعیت ${task.title}`}
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

                    {actorRole === "ADMIN" && (
                      <button
                        type="button"
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

                {/* Expanded task details */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                    {detailLoading ? (
                      <div className="flex justify-center py-8">
                        <LoaderCircle
                          size={22}
                          className="animate-spin text-indigo-600"
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
                                تاریخ شروع:{" "}
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
                                  className="text-indigo-600"
                                />
                                واگذاری مسئولیت
                              </h4>

                              <label className="block">
                                <span className="mb-2 block text-xs text-slate-500">
                                  مسئول جدید
                                </span>

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
                              </label>

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
                                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                              >
                                ذخیره واگذاری
                              </button>
                            </div>
                          )}

                          {canManage && (
                            <div className="space-y-3">
                              <h4 className="flex items-center gap-2 text-sm font-bold">
                                <History size={17} />
                                تاریخچه واگذاری
                              </h4>

                              {history.length === 0 && (
                                <p className="text-xs text-slate-400">
                                  هنوز واگذاری ثبت نشده
                                  است.
                                </p>
                              )}

                              {history.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-7"
                                >
                                  <p className="font-semibold text-slate-800">
                                    توسط{" "}
                                    {entry.changedBy.name}
                                  </p>

                                  <p className="mt-1 text-slate-600">
                                    {entry.fromUserName ||
                                      "بدون مسئول"}
                                    {" ← "}
                                    {entry.toUserName ||
                                      "بدون مسئول"}
                                  </p>

                                  {entry.note && (
                                    <p className="mt-1 text-slate-500">
                                      {entry.note}
                                    </p>
                                  )}

                                  <p className="mt-2 text-slate-400">
                                    {new Date(
                                      entry.createdAt
                                    ).toLocaleString(
                                      "fa-IR"
                                    )}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 font-bold text-slate-900">
                            <MessageCircle
                              size={18}
                              className="text-indigo-600"
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
                              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {busy ? (
                                <LoaderCircle
                                  size={15}
                                  className="animate-spin"
                                />
                              ) : (
                                <Send size={15} />
                              )}
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

      {/* Create task modal */}
      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="create-task-title"
                  className="text-xl font-extrabold text-slate-900"
                >
                  ایجاد وظیفه جدید
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  جزئیات و مسئول انجام کار را مشخص
                  کنید.
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                aria-label="بستن فرم"
                onClick={() => setCreating(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={createTask}
              className="mt-6 space-y-5"
            >
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
                    setDescription(
                      event.target.value
                    )
                  }
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="مسئول وظیفه">
                  <select
                    className={inputClass}
                    value={assigneeId}
                    onChange={(event) =>
                      setAssigneeId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      بدون مسئول
                    </option>

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

                <div className="hidden sm:block" />

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

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCreating(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 disabled:opacity-50"
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
                  ثبت وظیفه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <ConfirmDialog
          title="حذف وظیفه"
          description="این تسک همراه با کامنت‌ها و تاریخچه واگذاری آن به‌صورت دائمی حذف می‌شود. آیا مطمئن هستید؟"
          busy={busy}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => void deleteTask()}
        />
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white text-indigo-600">
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
