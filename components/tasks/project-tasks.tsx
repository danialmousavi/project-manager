
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
  ClipboardList,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";

import {
  isoToJalali,
  jalaliToIso,
} from "@/lib/jalali";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Member = {
  role: "MANAGER" | "MEMBER";
  user: {
    id: string;
    name: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  };
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
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

type Props = {
  projectId: string;
  members: Member[];
  canManage: boolean;
};

const statusLabels: Record<TaskStatus, string> = {
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

const statusColors: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

export default function ProjectTasks({
  projectId,
  members,
  canManage,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [openTaskId, setOpenTaskId] = useState<string | null>(
    null
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const employees = members.filter(
    (member) =>
      member.role === "MEMBER" &&
      member.user.role === "EMPLOYEE"
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/tasks`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت تسک‌ها ناموفق بود"
        );
      }

      setTasks(data.tasks);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در دریافت تسک‌ها"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function createTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManage || saving) return;

    const isoStart = startDate
      ? jalaliToIso(startDate)
      : null;

    const isoDue = dueDate
      ? jalaliToIso(dueDate)
      : null;

    if (startDate && !isoStart) {
      setError("تاریخ شروع معتبر نیست.");
      return;
    }

    if (dueDate && !isoDue) {
      setError("تاریخ پایان معتبر نیست.");
      return;
    }

    if (isoStart && isoDue && isoStart > isoDue) {
      setError("تاریخ پایان قبل از تاریخ شروع است.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/tasks`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description,
            priority,
            status,
            assigneeId: assigneeId || null,
            startDate: isoStart,
            dueDate: isoDue,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ایجاد تسک ناموفق بود"
        );
      }

      setTasks((previous) => [data.task, ...previous]);

      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setStatus("TODO");
      setAssigneeId("");
      setStartDate("");
      setDueDate("");
      setShowForm(false);

      setNotice("تسک جدید با موفقیت ایجاد شد.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ایجاد تسک"
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    taskId: string,
    nextStatus: TaskStatus
  ) {
    if (busyId) return;

    setBusyId(taskId);
    setError("");
    setNotice("");

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
          data.message || "تغییر وضعیت ناموفق بود"
        );
      }

      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId
            ? { ...task, status: nextStatus }
            : task
        )
      );

      setNotice("وضعیت تسک تغییر کرد.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در تغییر وضعیت"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleComments(taskId: string) {
    if (openTaskId === taskId) {
      setOpenTaskId(null);
      return;
    }

    setOpenTaskId(taskId);
    setComments([]);
    setCommentText("");
    setCommentsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}/comments`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت کامنت‌ها ناموفق بود"
        );
      }

      setComments(data.comments);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در دریافت کامنت‌ها"
      );
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!openTaskId || commentSaving) return;

    const taskId = openTaskId;

    setCommentSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}/comments`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: commentText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ثبت کامنت ناموفق بود"
        );
      }

      setComments((previous) => [
        ...previous,
        data.comment,
      ]);

      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId
            ? {
                ...task,
                _count: {
                  comments: task._count.comments + 1,
                },
              }
            : task
        )
      );

      setCommentText("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ثبت کامنت"
      );
    } finally {
      setCommentSaving(false);
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const q = search.trim().toLowerCase();

    const matchesSearch =
      task.title.toLowerCase().includes(q) ||
      (task.description ?? "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "ALL" ||
      task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ClipboardList
              size={21}
              className="text-indigo-600"
            />
            وظایف پروژه
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            ایجاد، پیگیری و گفتگو درباره وظایف
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((previous) => !previous);
              setError("");
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {showForm ? <X size={17} /> : <Plus size={17} />}
            {showForm ? "بستن فرم" : "تسک جدید"}
          </button>
        )}
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

      {showForm && canManage && (
        <form
          onSubmit={createTask}
          className="mt-6 space-y-5 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5"
        >
          <h3 className="font-bold text-slate-900">
            ایجاد وظیفه جدید
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
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
                placeholder="مثلاً پیاده‌سازی صفحه گزارش‌ها"
              />
            </Field>

            <Field label="مسئول وظیفه">
              <select
                className={inputClass}
                value={assigneeId}
                onChange={(event) =>
                  setAssigneeId(event.target.value)
                }
              >
                <option value="">بدون مسئول</option>
                {employees.map((member) => (
                  <option
                    key={member.user.id}
                    value={member.user.id}
                  >
                    {member.user.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="توضیحات">
                <textarea
                  className={inputClass}
                  rows={3}
                  maxLength={5000}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="توضیحات و جزئیات وظیفه..."
                />
              </Field>
            </div>

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

            <Field label="وضعیت اولیه">
              <select
                className={inputClass}
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as TaskStatus
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

            <Field label="تاریخ شروع شمسی">
              <input
                className={inputClass}
                dir="ltr"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
                placeholder="1405/08/20"
              />
            </Field>

            <Field label="مهلت انجام شمسی">
              <input
                className={inputClass}
                dir="ltr"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(event.target.value)
                }
                placeholder="1405/09/10"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Plus size={17} />
              )}
              {saving ? "در حال ذخیره..." : "ثبت تسک"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className={`${inputClass} pr-10`}
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="جست‌وجوی وظایف..."
          />
        </div>

        <select
          className={`${inputClass} sm:w-44`}
          aria-label="فیلتر وضعیت وظایف"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
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

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-14 text-slate-500">
          <LoaderCircle
            size={22}
            className="animate-spin"
          />
          <span className="text-sm">
            در حال دریافت وظایف...
          </span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <ClipboardList
            size={32}
            className="mx-auto text-slate-300"
          />
          <p className="mt-3 text-sm text-slate-500">
            وظیفه‌ای برای نمایش وجود ندارد.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filteredTasks.map((task) => (
            <article
              key={task.id}
              className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                      {task.description}
                    </p>
                  )}
                </div>

                <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
                  اولویت {priorityLabels[task.priority]}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <UserRound size={14} />
                  {task.assignee?.name || "بدون مسئول"}
                </span>

                {task.dueDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={14} />
                    {isoToJalali(task.dueDate)}
                  </span>
                )}

                <span
                  className={`rounded-lg px-3 py-1.5 ${statusColors[task.status]}`}
                >
                  {statusLabels[task.status]}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <select
                  aria-label={`تغییر وضعیت ${task.title}`}
                  disabled={busyId === task.id}
                  value={task.status}
                  onChange={(event) =>
                    changeStatus(
                      task.id,
                      event.target.value as TaskStatus
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  {Object.entries(statusLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    toggleComments(task.id)
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <MessageCircle size={15} />
                  کامنت‌ها
                  <span>
                    {task._count.comments.toLocaleString(
                      "fa-IR"
                    )}
                  </span>
                </button>
              </div>

              {openTaskId === task.id && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <h4 className="mb-4 text-sm font-bold text-slate-800">
                    گفتگو درباره وظیفه
                  </h4>

                  {commentsLoading ? (
                    <div className="flex justify-center py-5">
                      <LoaderCircle
                        size={20}
                        className="animate-spin text-indigo-600"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.length === 0 && (
                        <p className="text-sm text-slate-400">
                          هنوز کامنتی ثبت نشده است.
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
                              ).toLocaleString("fa-IR")}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                            {comment.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    onSubmit={submitComment}
                    className="mt-4 space-y-3"
                  >
                    <textarea
                      className={inputClass}
                      rows={3}
                      required
                      maxLength={2000}
                      value={commentText}
                      onChange={(event) =>
                        setCommentText(event.target.value)
                      }
                      placeholder="کامنت خود را بنویسید..."
                    />

                    <button
                      type="submit"
                      disabled={
                        commentSaving ||
                        !commentText.trim()
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {commentSaving ? (
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
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>
          نمایش {filteredTasks.length.toLocaleString("fa-IR")} وظیفه
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={14} />
          متصل به دیتابیس
        </span>
      </div>
    </section>
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
