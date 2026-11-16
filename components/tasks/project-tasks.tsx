
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
  FolderTree,
  GitBranch,
  History,
  Link2,
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
import TaskAttachments from "@/components/tasks/task-attachments";
import { isoToJalali } from "@/lib/jalali";

export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE" | "CONTROLLER";

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

type TaskType = "STORY" | "TASK" | "BUG";

export type Member = {
  role: "MANAGER" | "MEMBER" | "CONTROLLER";
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
  type: TaskType;
  storyPoints: number | null;
  rank: number;
  acceptanceCriteria: string | null;
  epicId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  sprintId: string | null;
  epic: { id: string; name: string } | null;
  milestone: { id: string; title: string } | null;
  parentTask: { id: string; title: string; type: TaskType } | null;
  sprint: { id: string; name: string; status: string } | null;
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
  blockedByCount: number;
  _count: {
    comments: number;
    subtasks: number;
  };
};

type Epic = { id: string; name: string; description: string | null; _count: { tasks: number } };
export type MilestoneOption = { id: string; title: string; targetDate: string; displayStatus: "PLANNED" | "DUE_SOON" | "OVERDUE" | "COMPLETED" };
type TaskDependency = {
  id: string;
  isBlocking: boolean;
  task: { id: string; title: string; status: Status; type: TaskType; assignee: { id: string; name: string } | null };
};

type TaskDetail = {
  epic: { id: string; name: string } | null;
  milestone: { id: string; title: string } | null;
  parentTask: { id: string; title: string } | null;
  subtasks: { id: string; title: string; type: TaskType; status: Status; storyPoints: number | null }[];
  dependencies: TaskDependency[];
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
  | "type"
  | "storyPoints"
  | "rank"
  | "acceptanceCriteria"
  | "milestoneId"
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

type TaskTreeRow =
  | { kind: "sprint"; id: string; label: string; count: number; backlog?: boolean }
  | { kind: "epic"; id: string; label: string; count: number; ungrouped?: boolean }
  | { kind: "task"; task: Task; depth: 0 | 1 };

type TaskTreeSection = {
  id: string;
  label: string;
  count: number;
  backlog: boolean;
  rows: Exclude<TaskTreeRow, { kind: "sprint" }>[];
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

const taskTypeLabels: Record<TaskType, string> = {
  STORY: "استوری",
  TASK: "تسک",
  BUG: "باگ",
};

const taskTypeColors: Record<TaskType, string> = {
  STORY: "bg-violet-50 text-violet-700",
  TASK: "bg-slate-100 text-slate-700",
  BUG: "bg-rose-50 text-rose-700",
};

const fieldLabels: Record<FieldName, string> = {
  title: "عنوان",
  description: "توضیحات",
  type: "نوع کار",
  storyPoints: "Story Points",
  rank: "Backlog Rank",
  acceptanceCriteria: "معیارهای پذیرش",
  milestoneId: "مایلستون",
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

const storyPointOptions = [1, 3, 5, 8, 13] as const;

function buildTaskTreeRows(tasks: Task[]): TaskTreeRow[] {
  const groups = new Map<string, { sprint: Task["sprint"]; tasks: Task[] }>();

  for (const task of tasks) {
    const key = task.sprintId ?? "backlog";
    const group = groups.get(key) ?? { sprint: task.sprint, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }

  const orderedGroups = [...groups.entries()].sort(([leftId, left], [rightId, right]) => {
    if (leftId === "backlog") return 1;
    if (rightId === "backlog") return -1;
    if (left.sprint?.status === "ACTIVE") return -1;
    if (right.sprint?.status === "ACTIVE") return 1;
    return (left.sprint?.name ?? "").localeCompare(right.sprint?.name ?? "", "fa");
  });

  const rows: TaskTreeRow[] = [];
  for (const [sprintId, group] of orderedGroups) {
    const isBacklog = sprintId === "backlog";
    rows.push({
      kind: "sprint",
      id: sprintId,
      label: isBacklog ? "بک‌لاگ بدون اسپرینت" : group.sprint?.name ?? "اسپرینت نامشخص",
      count: group.tasks.length,
      backlog: isBacklog,
    });

    const taskById = new Map(group.tasks.map((task) => [task.id, task]));
    const roots = group.tasks.filter((task) => !task.parentTaskId || !taskById.has(task.parentTaskId));
    const childrenFor = (parentId: string) => group.tasks.filter((task) => task.parentTaskId === parentId);
    const epicGroups = new Map<string, { label: string; tasks: Task[]; ungrouped: boolean }>();

    for (const task of roots) {
      const key = task.epic?.id ?? "no-epic";
      const epic = epicGroups.get(key) ?? {
        label: task.epic?.name ?? "تسک‌های بدون اپیک",
        tasks: [],
        ungrouped: !task.epic,
      };
      epic.tasks.push(task);
      epicGroups.set(key, epic);
    }

    for (const [epicId, epic] of epicGroups) {
      rows.push({ kind: "epic", id: `${sprintId}-${epicId}`, label: epic.label, count: epic.tasks.length, ungrouped: epic.ungrouped });
      for (const parent of epic.tasks) {
        rows.push({ kind: "task", task: parent, depth: 0 });
        for (const child of childrenFor(parent.id)) rows.push({ kind: "task", task: child, depth: 1 });
      }
    }
  }

  return rows;
}

function buildTaskTreeSections(rows: TaskTreeRow[]): TaskTreeSection[] {
  const sections: TaskTreeSection[] = [];
  let current: TaskTreeSection | null = null;

  for (const row of rows) {
    if (row.kind === "sprint") {
      current = { id: row.id, label: row.label, count: row.count, backlog: Boolean(row.backlog), rows: [] };
      sections.push(current);
    } else if (current) {
      current.rows.push(row);
    }
  }

  return sections;
}

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

  if (field === "type") {
    return taskTypeLabels[value as TaskType] ?? value;
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
  const [epics, setEpics] = useState<Epic[]>([]);
  const [milestones, setMilestones] = useState<MilestoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [openSectionId, setOpenSectionId] = useState<string | null | undefined>(undefined);

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
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [commentText, setCommentText] = useState("");

  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [dependencyTaskId, setDependencyTaskId] = useState("");

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
      const [response, epicsResponse, milestonesResponse] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/tasks`, { cache: "no-store" }),
        fetch(`/api/v1/projects/${projectId}/epics`, { cache: "no-store" }),
        fetch(`/api/v1/projects/${projectId}/milestones`, { cache: "no-store" }),
      ]);
      const [data, epicsData, milestonesData] = await Promise.all([response.json(), epicsResponse.json(), milestonesResponse.json()]);

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت وظایف ناموفق بود."
        );
      }

      setTasks(data.tasks ?? []);
      if (epicsResponse.ok) setEpics(epicsData.epics ?? []);
      if (milestonesResponse.ok) setMilestones(milestonesData.milestones ?? []);
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

      // A status change can unblock other tasks, so update every row's
      // dependency state instead of changing only the edited task locally.
      await loadTasks();

      if (activeTaskId) {
        await refreshTaskDetail(activeTaskId);
      }

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
    setTaskDetail(null);
    setDependencyTaskId("");
    setCommentText("");
    setDetailLoading(true);
    setError("");

    try {
      const urls = [
        `/api/v1/tasks/${task.id}`,
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

      setTaskDetail(payloads[0].task ?? null);
      setComments(payloads[1].comments ?? []);

      if (canManage) {
        setHistory(payloads[2].history ?? []);
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

  async function refreshTaskDetail(taskId: string) {
    const response = await fetch(`/api/v1/tasks/${taskId}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "دریافت وابستگی‌های تسک ناموفق بود.");
    }

    setTaskDetail(data.task ?? null);
  }

  async function addDependency() {
    if (!activeTask || !canManage || busy || !dependencyTaskId) return;

    setBusy(true);
    setError("");

    try {
      await sendApi(`/api/v1/tasks/${activeTask.id}/dependencies`, "POST", {
        prerequisiteTaskId: dependencyTaskId,
      });
      await refreshTaskDetail(activeTask.id);
      setDependencyTaskId("");
      setNotice("وابستگی تسک ثبت شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeDependency(dependencyId: string) {
    if (!activeTask || !canManage || busy) return;

    setBusy(true);
    setError("");

    try {
      await sendApi(`/api/v1/tasks/${activeTask.id}/dependencies`, "DELETE", {
        dependencyId,
      });
      await refreshTaskDetail(activeTask.id);
      setNotice("وابستگی تسک حذف شد.");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
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

  const treeSections = buildTaskTreeSections(buildTaskTreeRows(filteredTasks));
  const defaultSectionId = tasks.find((task) => task.sprint?.status === "ACTIVE")?.sprintId ?? null;
  const expandedSectionId = openSectionId === undefined ? defaultSectionId : openSectionId;

  const doneCount = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const doingCount = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <ClipboardList
              size={20}
              className="text-emerald-600"
            />
            مدیریت وظایف
          </h2>

          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
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
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={18} />
            وظیفه جدید
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
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

      <div className="mt-5 flex flex-col gap-2.5 rounded-xl bg-slate-50 p-3 sm:flex-row">
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

      <div className="mt-4 space-y-2.5">
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
          treeSections.map((section) => (
            <section key={section.id} className={`overflow-hidden rounded-2xl border shadow-sm ${section.backlog ? "border-violet-200 bg-violet-50/30" : "border-emerald-200 bg-emerald-50/20"}`}>
              <button type="button" aria-expanded={expandedSectionId === section.id} onClick={() => setOpenSectionId(expandedSectionId === section.id ? null : section.id)} className={`flex w-full flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-right sm:px-5 ${section.backlog ? "border-violet-200 bg-violet-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
                <div className="flex items-center gap-2.5"><span className={`flex size-8 items-center justify-center rounded-lg bg-white shadow-sm ${section.backlog ? "text-violet-700" : "text-emerald-700"}`}><FolderTree size={17} /></span><div><h3 className="text-sm font-extrabold text-slate-900">{section.label}</h3><p className="mt-0.5 text-[11px] text-slate-500">{section.backlog ? "تسک‌هایی که هنوز در اسپرینت قرار نگرفته‌اند" : "ساختار اپیک، تسک اصلی و زیرتسک"}</p></div></div>
                <span className="flex items-center gap-2"><span className={`rounded-md bg-white px-2 py-1 text-[11px] font-bold shadow-sm ${section.backlog ? "text-violet-700" : "text-emerald-700"}`}>{section.count.toLocaleString("fa-IR")} تسک</span><ChevronDown size={17} className={`text-slate-500 transition-transform ${expandedSectionId === section.id ? "rotate-180" : ""}`} /></span>
              </button>
              {expandedSectionId === section.id && <div className="space-y-1.5 p-2 sm:p-3">
                {section.rows.map((row) => {
            if (row.kind === "epic") {
              return (
                <div key={`epic-${row.id}`} className={`mr-3 flex items-center gap-2 border-r-2 py-2 pr-3 ${row.ungrouped ? "border-slate-200" : "border-indigo-200"}`}>
                  <FolderTree size={15} className={row.ungrouped ? "text-slate-500" : "text-indigo-600"} />
                  <p className={`text-xs font-extrabold ${row.ungrouped ? "text-slate-700" : "text-indigo-800"}`}>{row.ungrouped ? row.label : `Epic: ${row.label}`}</p>
                  <span className="text-[10px] text-slate-500">{row.count.toLocaleString("fa-IR")} تسک اصلی</span>
                </div>
              );
            }

            const { task, depth } = row;
            const expanded =
              activeTaskId === task.id;

            return (
              <article
                key={task.id}
                id={`task-${task.id}`}
                className={`overflow-hidden rounded-2xl border transition ${depth === 1 ? "mr-7 border-sky-200 bg-sky-50/20" : ""} ${
                  expanded
                    ? "border-emerald-300 shadow-md"
                    : "border-slate-200 hover:border-emerald-200"
                }`}
              >
                <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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

                      <h3 className="flex items-center gap-1.5 font-bold text-slate-900">
                        {depth === 1 && <GitBranch size={14} className="text-sky-600" />}
                        {task.title}
                      </h3>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`rounded-md px-2 py-1 font-semibold ${taskTypeColors[task.type]}`}
                      >
                        {taskTypeLabels[task.type]}
                      </span>

                      {task.storyPoints !== null && (
                        <span className="rounded-md bg-violet-50 px-2 py-1 font-semibold text-violet-700">
                          {task.storyPoints.toLocaleString("fa-IR")} SP
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1">
                        <UserRound size={14} />
                        {task.assignee?.name ||
                          "بدون مسئول"}
                      </span>

                      {task.epic && <span className="rounded-md bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">Epic: {task.epic.name}</span>}

                      {task.milestone && <span className="rounded-md bg-fuchsia-50 px-2 py-1 font-semibold text-fuchsia-700">مایلستون: {task.milestone.title}</span>}

                      {task.blockedByCount > 0 && <span className="rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-700">مسدود · {task.blockedByCount.toLocaleString("fa-IR")} پیش‌نیاز</span>}

                      {task.parentTask && <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">زیرتسکِ {task.parentTask.title}</span>}

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
                  <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4">
                    {detailLoading ? (
                      <div className="flex justify-center py-8">
                        <LoaderCircle
                          size={22}
                          className="animate-spin text-emerald-600"
                        />
                      </div>
                    ) : (
                      <div className="grid items-start gap-3 lg:grid-cols-2">
                        <div className="grid min-w-0 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <h4 className="font-bold text-slate-900">
                              جزئیات وظیفه
                            </h4>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                              {task.description ||
                                "توضیحی ثبت نشده است."}
                            </p>

                            <dl className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                              <div className="rounded-lg bg-white px-3 py-2">
                                <dt className="text-slate-400">نوع کار</dt>
                                <dd className="mt-1 font-semibold text-slate-700">
                                  {taskTypeLabels[task.type]}
                                </dd>
                              </div>
                              <div className="rounded-lg bg-white px-3 py-2">
                                <dt className="text-slate-400">Story Points / Backlog Rank</dt>
                                <dd className="mt-1 font-semibold text-slate-700">
                                  {task.storyPoints === null
                                    ? "بدون برآورد"
                                    : `${task.storyPoints.toLocaleString("fa-IR")} SP`}
                                  {" · "}
                                  {task.rank.toLocaleString("fa-IR")}
                                </dd>
                              </div>
                            </dl>

                            {task.acceptanceCriteria && (
                              <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                                <h5 className="text-xs font-bold text-violet-800">
                                  معیارهای پذیرش
                                </h5>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-violet-950">
                                  {task.acceptanceCriteria}
                                </p>
                              </div>
                            )}

                            {taskDetail && (
                              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                                <h5 className="text-xs font-bold text-indigo-800">Epic و زیرتسک‌ها</h5>
                                <p className="mt-2 text-sm text-indigo-950">{taskDetail.epic ? `Epic: ${taskDetail.epic.name}` : "به Epic متصل نیست"}{taskDetail.parentTask ? ` · زیرتسکِ ${taskDetail.parentTask.title}` : ""}</p>
                                {taskDetail.subtasks.length > 0 && <ul className="mt-2 space-y-1 text-xs text-indigo-900">{taskDetail.subtasks.map((subtask) => <li key={subtask.id} className="rounded-lg bg-white/80 px-2 py-1.5">{subtask.title} · {taskTypeLabels[subtask.type]} · {statusLabels[subtask.status]}</li>)}</ul>}
                              </div>
                            )}

                            {taskDetail && (
                              <div className={`mt-4 rounded-xl border p-3 ${taskDetail.dependencies.some((dependency) => dependency.isBlocking) ? "border-rose-200 bg-rose-50/70" : "border-sky-100 bg-sky-50/60"}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><Link2 size={15} className={taskDetail.dependencies.some((dependency) => dependency.isBlocking) ? "text-rose-600" : "text-sky-600"} />وابستگی‌های تسک</h5>
                                  {taskDetail.dependencies.some((dependency) => dependency.isBlocking) && <span className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700">مسدودشده</span>}
                                </div>
                                {taskDetail.dependencies.length === 0 ? <p className="mt-2 text-xs text-slate-500">این تسک پیش‌نیازی ندارد و منتظر تسک دیگری نیست.</p> : <ul className="mt-2 space-y-1.5">{taskDetail.dependencies.map((dependency) => <li key={dependency.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/85 px-2.5 py-2 text-xs"><div><span className="font-semibold text-slate-800">{dependency.task.title}</span><span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${dependency.isBlocking ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{dependency.isBlocking ? "انجام نشده" : "انجام شده"}</span>{dependency.task.assignee && <span className="mr-1.5 text-[10px] text-slate-500">{dependency.task.assignee.name}</span>}</div>{canManage && <button type="button" disabled={busy} onClick={() => void removeDependency(dependency.id)} className="rounded-md px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">حذف</button>}</li>)}</ul>}
                                {canManage && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/70 pt-3"><select value={dependencyTaskId} onChange={(event) => setDependencyTaskId(event.target.value)} className={`${inputClass} min-w-52 flex-1 !py-2 text-xs`}><option value="">انتخاب تسک پیش‌نیاز...</option>{tasks.filter((candidate) => candidate.id !== task.id && !taskDetail.dependencies.some((dependency) => dependency.task.id === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} — {statusLabels[candidate.status]}</option>)}</select><button type="button" disabled={busy || !dependencyTaskId} onClick={() => void addDependency()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"><Link2 size={14} />افزودن پیش‌نیاز</button></div>}
                              </div>
                            )}

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
                            <details className="group rounded-xl border border-slate-200 bg-white p-3">
                              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-900">
                                <History size={17} />
                                تاریخچه فعالیت‌ها
                                <span className="mr-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{history.length.toLocaleString("fa-IR")}</span>
                                <ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180" />
                              </summary>

                              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
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
                            </details>
                          )}
                        </div>

                        <div className="min-w-0 space-y-3">
                          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
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

                          <TaskAttachments taskId={task.id} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
                })}
              </div>}
            </section>
          ))
        )}
      </div>

      {creating && (
        <TaskFormModal
          title="ایجاد وظیفه جدید"
          submitLabel="ثبت وظیفه"
          assignees={assignees}
          epics={epics}
          milestones={milestones}
          parentTasks={tasks.filter((task) => !task.parentTaskId)}
          dependencyTasks={tasks.map((task) => ({ id: task.id, title: task.title, status: task.status }))}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const data = await sendApi(
              `/api/v1/projects/${projectId}/tasks`,
              "POST",
              {
                title: values.title,
                description: values.description,
                type: values.type,
                storyPoints: values.storyPoints,
                rank: values.rank,
                acceptanceCriteria: values.acceptanceCriteria,
                epicId: values.epicId,
                milestoneId: values.milestoneId,
                parentTaskId: values.parentTaskId,
                status: values.status,
                priority: values.priority,
                assigneeId: values.assigneeId,
                startDate: values.startDate,
                dueDate: values.dueDate,
              }
            );

            await Promise.all(values.dependencyTaskIds.map((prerequisiteTaskId) =>
              sendApi(`/api/v1/tasks/${data.task.id}/dependencies`, "POST", { prerequisiteTaskId })
            ));

            await loadTasks();

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
          epics={epics}
          milestones={milestones}
          parentTasks={tasks.filter((task) => !task.parentTaskId && task.id !== editingTask.id)}
          dependencyTasks={tasks.map((task) => ({ id: task.id, title: task.title, status: task.status }))}
          onDependenciesChanged={loadTasks}
          onClose={() => setEditingTask(null)}
          onSubmit={async (values) => {
            const taskId = editingTask.id;
            const { dependencyTaskIds, ...taskValues } = values;
            void dependencyTaskIds;

            await sendApi(
              `/api/v1/tasks/${taskId}`,
              "PATCH",
              taskValues
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

export type FormValues = {
  title: string;
  description: string;
  type: TaskType;
  storyPoints: number | null;
  rank: number;
  acceptanceCriteria: string;
  epicId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  note: string;
  dependencyTaskIds: string[];
};

export function TaskFormModal({
  title: modalTitle,
  submitLabel,
  task,
  assignees = [],
  epics = [],
  milestones = [],
  parentTasks = [],
  dependencyTasks = [],
  onDependenciesChanged,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  task?: Task;
  assignees?: Member[];
  epics?: Epic[];
  milestones?: MilestoneOption[];
  parentTasks?: { id: string; title: string }[];
  dependencyTasks?: { id: string; title: string; status: Status }[];
  onDependenciesChanged?: () => Promise<void>;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(
    task?.description ?? ""
  );
  const [type, setType] = useState<TaskType>(
    task?.type ?? "TASK"
  );
  const [storyPoints, setStoryPoints] = useState(
    task?.storyPoints?.toString() ?? ""
  );
  const [rank, setRank] = useState(
    task?.rank?.toString() ?? "0"
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    task?.acceptanceCriteria ?? ""
  );
  const [epicId, setEpicId] = useState(task?.epicId ?? "");
  const [milestoneId, setMilestoneId] = useState(task?.milestoneId ?? "");
  const [parentTaskId, setParentTaskId] = useState(task?.parentTaskId ?? "");
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
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [dependencyTaskId, setDependencyTaskId] = useState("");
  const [dependencyBusy, setDependencyBusy] = useState(false);
  const [dependencyError, setDependencyError] = useState("");
  const [pendingDependencyIds, setPendingDependencyIds] = useState<string[]>([]);
  const editableTaskId = task?.id;

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  useEffect(() => {
    if (!editableTaskId) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/tasks/${editableTaskId}/dependencies`, { cache: "no-store", credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "دریافت وابستگی‌های تسک ناموفق بود.");
        if (!cancelled) setDependencies(data.dependencies ?? []);
      } catch (cause) {
        if (!cancelled) setDependencyError(messageOf(cause));
      }
    })();

    return () => { cancelled = true; };
  }, [editableTaskId]);

  async function updateDependencies(method: "POST" | "DELETE", body: Record<string, string>) {
    if (!task || dependencyBusy) return;
    setDependencyBusy(true);
    setDependencyError("");

    try {
      const response = await fetch(`/api/v1/tasks/${task.id}/dependencies`, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ذخیره وابستگی ناموفق بود.");

      const refreshed = await fetch(`/api/v1/tasks/${task.id}/dependencies`, { cache: "no-store", credentials: "same-origin" });
      const refreshedData = await refreshed.json();
      if (!refreshed.ok) throw new Error(refreshedData.message || "به‌روزرسانی وابستگی ناموفق بود.");
      setDependencies(refreshedData.dependencies ?? []);
      setDependencyTaskId("");
      await onDependenciesChanged?.();
    } catch (cause) {
      setDependencyError(messageOf(cause));
    } finally {
      setDependencyBusy(false);
    }
  }

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

    const parsedStoryPoints = storyPoints.trim() === ""
      ? null
      : Number(storyPoints);
    const parsedRank = Number(rank);

    if (
      (parsedStoryPoints !== null &&
        !storyPointOptions.includes(parsedStoryPoints as (typeof storyPointOptions)[number])) ||
      !Number.isFinite(parsedRank) ||
      parsedRank < 0 ||
      parsedRank > 100_000
    ) {
      setError("Story Points را از گزینه‌های ۱، ۳، ۵، ۸ یا ۱۳ انتخاب کنید. Backlog Rank باید بین ۰ تا ۱۰۰٬۰۰۰ باشد.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({
        title,
        description,
        type,
        storyPoints: parsedStoryPoints,
        rank: parsedRank,
        acceptanceCriteria,
        epicId: epicId || null,
        milestoneId: milestoneId || null,
        parentTaskId: parentTaskId || null,
        status,
        priority,
        assigneeId: assigneeId || null,
        startDate,
        dueDate,
        note,
        dependencyTaskIds: pendingDependencyIds,
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
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/20"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 bg-gradient-to-l from-emerald-700 via-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div>
            <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-emerald-50">مدیریت وظیفه</span>
            <h2
              id="task-form-title"
              className="mt-2 text-xl font-extrabold"
            >
              {modalTitle}
            </h2>
            <p className="mt-1.5 text-sm text-emerald-50">
              اطلاعات وظیفه و زمان‌بندی را تکمیل کنید.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            aria-label="بستن فرم"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
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

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="نوع کار">
                <select
                  className={inputClass}
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as TaskType)
                  }
                >
                  {Object.entries(taskTypeLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Story Points (اختیاری)">
                <select
                  className={inputClass}
                  value={storyPoints}
                  onChange={(event) =>
                    setStoryPoints(event.target.value)
                  }
                >
                  <option value="">بدون برآورد</option>
                  {storyPointOptions.map((point) => <option key={point} value={point}>{point.toLocaleString("fa-IR")} پوینت</option>)}
                </select>
              </Field>

              <Field label="Backlog Rank (۰ تا ۱۰۰٬۰۰۰)">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100000"
                  step="any"
                  value={rank}
                  onChange={(event) => setRank(event.target.value)}
                />
              </Field>
            </div>

            <Field label="معیارهای پذیرش (اختیاری)">
              <textarea
                className={inputClass}
                rows={3}
                maxLength={5000}
                value={acceptanceCriteria}
                onChange={(event) =>
                  setAcceptanceCriteria(event.target.value)
                }
                placeholder="شرایطی که نشان می‌دهد این کار قابل پذیرش است..."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Epic (اختیاری)">
                <select className={inputClass} value={epicId} onChange={(event) => setEpicId(event.target.value)}>
                  <option value="">بدون Epic</option>
                  {epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.name}</option>)}
                </select>
              </Field>
              <Field label="مایلستون (اختیاری)">
                <select className={inputClass} value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
                  <option value="">بدون مایلستون</option>
                  {milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
                </select>
              </Field>
              <Field label="تسک والد / Subtask (اختیاری)">
                <select className={inputClass} value={parentTaskId} onChange={(event) => setParentTaskId(event.target.value)}>
                  <option value="">آیتم سطح اول</option>
                  {parentTasks.map((parent) => <option key={parent.id} value={parent.id}>{parent.title}</option>)}
                </select>
              </Field>
            </div>

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

            {!task && dependencyTasks.length > 0 && (
              <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><Link2 size={17} className="text-sky-600" />پیش‌نیازهای تسک</h3>
                <p className="mt-1 text-xs text-slate-500">تسک‌های لازم را انتخاب کنید؛ پس از ایجاد تسک، وابستگی‌ها خودکار ثبت می‌شوند.</p>
                {pendingDependencyIds.length > 0 && <ul className="mt-3 space-y-1.5">{pendingDependencyIds.map((id) => { const candidate = dependencyTasks.find((item) => item.id === id); return candidate ? <li key={id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"><span className="font-bold text-slate-800">{candidate.title}</span><button type="button" onClick={() => setPendingDependencyIds((previous) => previous.filter((item) => item !== id))} className="text-rose-600">حذف</button></li> : null; })}</ul>}
                <div className="mt-3 flex flex-wrap gap-2"><select value={dependencyTaskId} onChange={(event) => setDependencyTaskId(event.target.value)} className={`${inputClass} min-w-52 flex-1 !py-2 text-xs`}><option value="">انتخاب تسک پیش‌نیاز...</option>{dependencyTasks.filter((candidate) => !pendingDependencyIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} — {statusLabels[candidate.status]}</option>)}</select><button type="button" disabled={!dependencyTaskId} onClick={() => { setPendingDependencyIds((previous) => [...previous, dependencyTaskId]); setDependencyTaskId(""); }} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Link2 size={14} />افزودن</button></div>
              </section>
            )}

            {task && (
              <section className={`rounded-2xl border p-4 ${dependencies.some((dependency) => dependency.isBlocking) ? "border-rose-200 bg-rose-50/70" : "border-sky-100 bg-sky-50/70"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><Link2 size={17} className="text-sky-600" />وابستگی‌ها و پیش‌نیازها</h3><p className="mt-1 text-xs text-slate-500">تسک‌هایی را انتخاب کنید که باید پیش از این تسک انجام شوند.</p></div>
                  {dependencies.some((dependency) => dependency.isBlocking) && <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">این تسک مسدود است</span>}
                </div>

                {dependencyError && <p role="alert" className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-700">{dependencyError}</p>}
                {dependencies.length === 0 ? <p className="mt-3 text-xs text-slate-500">هنوز پیش‌نیازی برای این تسک ثبت نشده است.</p> : <ul className="mt-3 space-y-2">{dependencies.map((dependency) => <li key={dependency.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm"><div className="min-w-0"><span className="font-bold text-slate-800">{dependency.task.title}</span><span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${dependency.isBlocking ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{dependency.isBlocking ? "انجام نشده" : "انجام شده"}</span></div><button type="button" disabled={dependencyBusy || saving} onClick={() => void updateDependencies("DELETE", { dependencyId: dependency.id })} className="rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">حذف</button></li>)}</ul>}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/70 pt-3"><select value={dependencyTaskId} disabled={dependencyBusy || saving} onChange={(event) => setDependencyTaskId(event.target.value)} className={`${inputClass} min-w-52 flex-1 !py-2 text-xs`}><option value="">انتخاب تسک پیش‌نیاز...</option>{dependencyTasks.filter((candidate) => candidate.id !== task.id && !dependencies.some((dependency) => dependency.task.id === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} — {statusLabels[candidate.status]}</option>)}</select><button type="button" disabled={dependencyBusy || saving || !dependencyTaskId} onClick={() => void updateDependencies("POST", { prerequisiteTaskId: dependencyTaskId })} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">{dependencyBusy && <LoaderCircle size={14} className="animate-spin" />}<Link2 size={14} />افزودن پیش‌نیاز</button></div>
              </section>
            )}

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

          <div className="flex shrink-0 justify-end gap-3 border-t border-emerald-100 bg-white px-6 py-4">
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
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-700 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-900/20 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-50"
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
