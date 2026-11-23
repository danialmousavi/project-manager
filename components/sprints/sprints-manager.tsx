
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import PersianDatePicker from "@/components/ui/persian-date-picker";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import SprintFormModal from "@/components/sprints/sprint-form-modal";
import SprintEndModal from "@/components/sprints/sprint-end-modal";
import type { Sprint, SprintStatus } from "@/components/sprints/types";
import PageGuide from "@/components/ui/page-guide";
import { pageGuides } from "@/lib/page-guides";
import {
  TaskFormModal,
  type FormValues,
  type Member,
} from "@/components/tasks/project-tasks";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

type Priority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

type Task = {
  id: string;
  title: string;
  description: string | null;
  type: "STORY" | "TASK" | "BUG";
  storyPoints: number | null;
  rank: number;
  acceptanceCriteria: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  sprintId: string | null;
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string;
  } | null;
};

type TaskDetail = {
  epic: { id: string; name: string } | null;
  parentTask: { id: string; title: string; type: "STORY" | "TASK" | "BUG" } | null;
  subtasks: { id: string; title: string; type: "STORY" | "TASK" | "BUG"; status: TaskStatus; storyPoints: number | null }[];
};

type Props = {
  projectId: string;
  members: Member[];
  canManage: boolean;
  canDelete: boolean;
  view: "GANTT" | "SPRINTS";
};

type DragMode = "move" | "start" | "end";

type DragState = {
  taskId: string;
  mode: DragMode;
  pointerX: number;
  originalStart: string;
  originalEnd: string;
  nextStart: string;
  nextEnd: string;
};

const DAY_WIDTH = 46;
const VISIBLE_DAYS = 56;
const GANTT_DAY_WIDTH = 60;
const GANTT_PAST_DAYS = 35;
const GANTT_VISIBLE_DAYS = 70;
const DAY_MS = 86_400_000;

const statusLabels: Record<TaskStatus, string> = {
  TODO: "برای انجام",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در حال بررسی",
  DONE: "انجام‌شده",
};

const statusColors: Record<TaskStatus, string> = {
  TODO: "#64748b",
  IN_PROGRESS: "#0ea5e9",
  IN_REVIEW: "#f59e0b",
  DONE: "#16a34a",
};

const activeSprintColors = [
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#65a30d",
];

function colorForSprint(sprintId: string) {
  let hash = 0;

  for (const character of sprintId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return activeSprintColors[Math.abs(hash) % activeSprintColors.length];
}

const priorityLabels: Record<Priority, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "زیاد",
  URGENT: "فوری",
};

const sprintLabels: Record<SprintStatus, string> = {
  FUTURE: "آینده",
  ACTIVE: "فعال",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

const inputClass =
  "w-full rounded-xl border border-emerald-200 " +
  "bg-white px-4 py-3 text-sm outline-none " +
  "focus:border-emerald-500 focus:ring-4 " +
  "focus:ring-emerald-500/10";

function utcTime(value: string) {
  return Date.parse(
    `${value.slice(0, 10)}T00:00:00.000Z`
  );
}

function addDays(value: string, days: number) {
  return new Date(
    utcTime(value) + days * DAY_MS
  ).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string) {
  return Math.round(
    (utcTime(a) - utcTime(b)) / DAY_MS
  );
}

function todayIso() {
  const date = new Date();

  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}

function persianDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
) {
  return new Intl.DateTimeFormat(
    "fa-IR-u-ca-persian",
    {
      ...options,
      timeZone: "UTC",
    }
  ).format(new Date(utcTime(value)));
}

function getError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داده است.";
}

function calculateDrag(
  drag: DragState,
  clientX: number,
  dayWidth: number,
) {
  const days = Math.round(
    (clientX - drag.pointerX) / dayWidth
  );

  if (drag.mode === "move") {
    return {
      startDate: addDays(drag.originalStart, days),
      dueDate: addDays(drag.originalEnd, days),
    };
  }

  if (drag.mode === "start") {
    const maxDays = diffDays(
      drag.originalEnd,
      drag.originalStart
    );

    return {
      startDate: addDays(
        drag.originalStart,
        Math.min(days, maxDays)
      ),
      dueDate: drag.originalEnd,
    };
  }

  const minDays = -diffDays(
    drag.originalEnd,
    drag.originalStart
  );

  return {
    startDate: drag.originalStart,
    dueDate: addDays(
      drag.originalEnd,
      Math.max(days, minDays)
    ),
  };
}

export default function SprintsManager({
  projectId,
  members,
  canManage,
  canDelete,
  view,
}: Props) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actorId, setActorId] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [anchor, setAnchor] = useState(todayIso);
  const [selectedSprint, setSelectedSprint] =
    useState("ALL");

  const [expandedSprints, setExpandedSprints] =
    useState<string[]>([]);

  const [selectedTaskId, setSelectedTaskId] =
    useState("");
  const [sprintSearch, setSprintSearch] = useState("");
  const [sprintSearchInput, setSprintSearchInput] = useState("");
  const [searchMatchedSprintIds, setSearchMatchedSprintIds] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);
  const [sprintEditor, setSprintEditor] = useState<
    "CREATE" | Sprint | null
  >(null);
  const [deletingSprint, setDeletingSprint] =
    useState<string | null>(null);
  const [endingSprint, setEndingSprint] =
    useState<Sprint | null>(null);

  const [editingTask, setEditingTask] =
    useState<Task | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);

  const [taskStart, setTaskStart] =
    useState<string | null>(null);
  const [taskEnd, setTaskEnd] =
    useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] =
    useState("");
  const [taskStatus, setTaskStatus] =
    useState<TaskStatus>("TODO");
  const [taskPriority, setTaskPriority] =
    useState<Priority>("MEDIUM");

  const [formError, setFormError] = useState("");

  const [drag, setDrag] =
    useState<DragState | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const didDragRef = useRef(false);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const hasPositionedTimeline = useRef(false);

  const visibleDays =
    view === "GANTT" ? GANTT_VISIBLE_DAYS : VISIBLE_DAYS;
  const pastDays = view === "GANTT" ? GANTT_PAST_DAYS : 7;
  const rangeStart = addDays(anchor, -pastDays);
  const dayWidth = view === "GANTT" ? GANTT_DAY_WIDTH : DAY_WIDTH;
  const rangeEnd = addDays(
    rangeStart,
    visibleDays - 1
  );

  const dates = Array.from(
    { length: visibleDays },
    (_, index) => addDays(rangeStart, index)
  );

  const today = todayIso();
  const timelineWidth = dayWidth * visibleDays;

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/sprints`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "دریافت اطلاعات ناموفق بود."
        );
      }

      setSprints(data.sprints ?? []);
      setTasks(data.tasks ?? []);
      setActorId(data.actorId ?? "");
      setError("");
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (view !== "GANTT" || loading || hasPositionedTimeline.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const timeline = timelineScrollRef.current;
      if (!timeline) return;

      const todayIndex = diffDays(todayIso(), rangeStart);
      const target = todayIndex * dayWidth + dayWidth / 2 - timeline.clientWidth / 2;
      timeline.scrollLeft = Math.max(0, Math.min(target, timeline.scrollWidth - timeline.clientWidth));
      hasPositionedTimeline.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [dayWidth, loading, rangeStart, view]);

  async function api(
    method: "POST" | "PATCH" | "DELETE",
    body: unknown
  ) {
    const response = await fetch(
      `/api/v1/projects/${projectId}/sprints`,
      {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "عملیات ناموفق بود.");
    }

    return data;
  }

  async function runAction(
    action: () => Promise<void>
  ) {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
    } catch (err) {
      setError(getError(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Use the existing Task API so task history is retained.
  async function updateTaskDates(
    task: Task,
    startDate: string | null,
    dueDate: string | null
  ) {
    if (!canManage || busyRef.current) return;

    if (
      startDate &&
      dueDate &&
      startDate > dueDate
    ) {
      setError("تاریخ پایان قبل از شروع است.");
      return;
    }

    if (
      task.startDate === startDate &&
      task.dueDate === dueDate
    ) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    const originalTask = task;

    setTasks((previous) =>
      previous.map((item) =>
        item.id === task.id
          ? { ...item, startDate, dueDate }
          : item
      )
    );

    try {
      const response = await fetch(
        `/api/v1/tasks/${task.id}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: task.title,
            description: task.description ?? "",
            priority: task.priority,
            status: task.status,
            startDate,
            dueDate,
            assigneeId: task.assigneeId,
            note: "تغییر زمان‌بندی از تایم‌لاین اسپرینت",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "ذخیره تاریخ تسک انجام نشد."
        );
      }

      setEditingTask(null);
      setNotice(
        `زمان‌بندی تسک «${task.title}» ذخیره شد.`
      );
    } catch (err) {
      setTasks((previous) =>
        previous.map((item) =>
          item.id === originalTask.id
            ? originalTask
            : item
        )
      );

      setError(getError(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function beginDrag(
    event: PointerEvent<HTMLDivElement>,
    task: Task,
    mode: DragMode
  ) {
    if (
      !canManage ||
      busyRef.current ||
      !task.startDate ||
      !task.dueDate ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    const initial: DragState = {
      taskId: task.id,
      mode,
      pointerX: event.clientX,
      originalStart: task.startDate,
      originalEnd: task.dueDate,
      nextStart: task.startDate,
      nextEnd: task.dueDate,
    };

    dragRef.current = initial;
    didDragRef.current = false;
    setDrag(initial);
  }

  function moveDrag(
    event: PointerEvent<HTMLDivElement>
  ) {
    const current = dragRef.current;
    if (!current) return;

    const next = calculateDrag(
      current,
      event.clientX,
      dayWidth,
    );

    const updated = {
      ...current,
      nextStart: next.startDate,
      nextEnd: next.dueDate,
    };

    if (Math.abs(event.clientX - current.pointerX) > 3) {
      didDragRef.current = true;
    }

    dragRef.current = updated;
    setDrag(updated);
  }

  function finishDrag(
    event: PointerEvent<HTMLDivElement>
  ) {
    const current = dragRef.current;

    dragRef.current = null;
    setDrag(null);

    if (!current) return;

    const next = calculateDrag(
      current,
      event.clientX,
      dayWidth,
    );

    const task = tasks.find(
      (item) => item.id === current.taskId
    );

    if (!task) return;

    if (!didDragRef.current) {
      if (current.mode === "move") {
        openTaskEditor(task);
      }
      return;
    }

    void updateTaskDates(
      task,
      next.startDate,
      next.dueDate
    );
  }

  function cancelDrag() {
    dragRef.current = null;
    didDragRef.current = false;
    setDrag(null);
  }

  function openTaskEditor(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskStart(task.startDate);
    setTaskEnd(task.dueDate);
    setFormError("");
    setTaskDetail(null);
    setTaskDetailLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/v1/tasks/${task.id}`, { cache: "no-store", credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "دریافت جزئیات تسک ناموفق بود.");
        setTaskDetail(data.task ?? null);
      } catch (err) {
        setFormError(getError(err));
      } finally {
        setTaskDetailLoading(false);
      }
    })();
  }

  function openTaskDates(task: Task) {
    openTaskEditor(task);
  }

  function saveTaskForm(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingTask || !canManage || busy) return;

    const title = taskTitle.trim();

    if (title.length < 3) {
      setFormError("عنوان تسک باید حداقل ۳ کاراکتر باشد.");
      return;
    }

    if (Boolean(taskStart) !== Boolean(taskEnd)) {
      setFormError("برای زمان‌بندی، هر دو تاریخ را انتخاب کنید.");
      return;
    }

    if (taskStart && taskEnd && taskStart > taskEnd) {
      setFormError("تاریخ پایان قبل از شروع است.");
      return;
    }

    const originalTask = editingTask;
    const updatedTask: Task = {
      ...editingTask,
      title,
      description: taskDescription.trim() || null,
      status: taskStatus,
      priority: taskPriority,
      startDate: taskStart,
      dueDate: taskEnd,
    };

    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setFormError("");
    setTasks((previous) =>
      previous.map((task) =>
        task.id === updatedTask.id ? updatedTask : task
      )
    );

    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/tasks/${updatedTask.id}`,
          {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: updatedTask.title,
              description: updatedTask.description ?? "",
              priority: updatedTask.priority,
              status: updatedTask.status,
              startDate: updatedTask.startDate,
              dueDate: updatedTask.dueDate,
              assigneeId: updatedTask.assigneeId,
              note: "ویرایش از صفحه اسپرینت",
            }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "ذخیره تغییرات تسک انجام نشد."
          );
        }

        setEditingTask(null);
        setNotice(`تغییرات تسک «${updatedTask.title}» ذخیره شد.`);
      } catch (err) {
        setTasks((previous) =>
          previous.map((task) =>
            task.id === originalTask.id ? originalTask : task
          )
        );
        setFormError(getError(err));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    })();
  }

  async function createTask(values: FormValues) {
    if (busyRef.current) {
      throw new Error("عملیات دیگری در حال انجام است.");
    }

    busyRef.current = true;
    setBusy(true);
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
            title: values.title,
            description: values.description,
            type: values.type,
            storyPoints: values.storyPoints,
            rank: values.rank,
            acceptanceCriteria: values.acceptanceCriteria,
            status: values.status,
            priority: values.priority,
            assigneeId: values.assigneeId,
            startDate: values.startDate,
            dueDate: values.dueDate,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "ایجاد تسک انجام نشد."
        );
      }

      setTasks((previous) => [data.task, ...previous]);
      setCreating(false);
      setNotice("تسک جدید ایجاد شد.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function saveSprint(values: {
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
  }) {
    if (!sprintEditor) return;

    void runAction(async () => {
      if (sprintEditor === "CREATE") {
        const data = await api("POST", values);
        setSprints((previous) => [...previous, data.sprint]);
        setNotice("اسپرینت آینده ایجاد شد.");
      } else {
        await api("PATCH", {
          action: "UPDATE_SPRINT",
          sprintId: sprintEditor.id,
          ...values,
        });
        await load();
        setNotice("اطلاعات اسپرینت ذخیره شد.");
      }

      setSprintEditor(null);
    });
  }

  function startSprint(sprint: Sprint) {
    void runAction(async () => {
      const data = await api("PATCH", {
        action: "START",
        sprintId: sprint.id,
      });

      setSprints((previous) =>
        previous.map((item) =>
          item.id === sprint.id
            ? {
                ...item,
                status: "ACTIVE",
                startSnapshot: data.snapshot,
              }
            : item
        )
      );
      setNotice("اسپرینت شروع شد و اطلاعات برنامه‌ریزی‌شده ثبت شد.");
    });
  }

  function endSprint(
    sprint: Sprint,
    unfinishedDestinationSprintId: string | null
  ) {
    void runAction(async () => {
      const data = await api("PATCH", {
        action: "END",
        sprintId: sprint.id,
        unfinishedDestinationSprintId,
      });

      setSprints((previous) =>
        previous.map((item) =>
          item.id === sprint.id
            ? {
                ...item,
                status: "COMPLETED",
                endSnapshot: data.result,
              }
            : item
        )
      );
      setTasks((previous) =>
        previous.map((task) =>
          task.sprintId === sprint.id && task.status !== "DONE"
            ? { ...task, sprintId: unfinishedDestinationSprintId }
            : task
        )
      );
      setEndingSprint(null);
      setExpandedSprints((current) =>
        current.includes(sprint.id)
          ? current
          : [...current, sprint.id]
      );
      setNotice("اسپرینت پایان یافت و گزارش نهایی آن ثبت شد.");
    });
  }

  function addTaskToSprint(sprintId: string) {
    if (!selectedTaskId) return;

    const taskId = selectedTaskId;

    void runAction(async () => {
      await api("PATCH", {
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
    });
  }

  function removeTaskFromSprint(
    sprintId: string,
    taskId: string
  ) {
    void runAction(async () => {
      await api("PATCH", {
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
    });
  }

  function deleteSprint() {
    if (!deletingSprint) return;

    const sprintId = deletingSprint;

    void runAction(async () => {
      await api("DELETE", { sprintId });

      setSprints((previous) =>
        previous.filter(
          (sprint) => sprint.id !== sprintId
        )
      );

      setTasks((previous) =>
        previous.map((task) =>
          task.sprintId === sprintId
            ? { ...task, sprintId: null }
            : task
        )
      );

      setDeletingSprint(null);
      setNotice("اسپرینت حذف شد؛ تسک‌ها حفظ شدند.");
    });
  }

  const displayedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          selectedSprint === "ALL" ||
          (selectedSprint === "BACKLOG"
            ? task.sprintId === null
            : task.sprintId === selectedSprint)
      ),
    [tasks, selectedSprint]
  );

  const activeSprints = useMemo(
    () => sprints.filter((sprint) => sprint.status === "ACTIVE"),
    [sprints]
  );

  const activeSprintById = useMemo(
    () => new Map(activeSprints.map((sprint) => [sprint.id, sprint])),
    [activeSprints]
  );

  const orderedTasks = useMemo(
    () =>
      [...displayedTasks].sort((a, b) =>
        (a.startDate ?? "9999").localeCompare(
          b.startDate ?? "9999"
        )
      ),
    [displayedTasks]
  );

  const unassignedTasks = tasks.filter(
    (task) => task.sprintId === null
  );

  const assignees = members.filter(
    (member) =>
      (member.role === "MEMBER" && member.user.companyRole === "EXPERT") ||
      (member.role === "MANAGER" && member.user.companyRole === "PROJECT_MANAGER")
  );

  const completedCount = displayedTasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const todayIndex = diffDays(today, rangeStart);

  function runSprintSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const query = sprintSearchInput.trim().toLocaleLowerCase("fa-IR");
    setSprintSearch(query);
    setSelectedTaskId("");

    if (!query) {
      setExpandedSprints([]);
      setSearchMatchedSprintIds([]);
      return;
    }

    const matchedSprintIds =
      sprints
        .filter((sprint) =>
          tasks.some(
            (task) =>
              task.sprintId === sprint.id &&
              (task.title.toLocaleLowerCase("fa-IR").includes(query) ||
                (task.assignee?.name ?? "")
                  .toLocaleLowerCase("fa-IR")
                  .includes(query))
          )
        )
        .map((sprint) => sprint.id);

    setSearchMatchedSprintIds(matchedSprintIds);
    setExpandedSprints(matchedSprintIds);
  }

  return (
    <div
      dir="rtl"
      className="space-y-6"
      style={{ color: "var(--foreground)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <CalendarRange
              size={20}
              className="text-emerald-600"
            />
            {view === "GANTT" ? "گانت چارت وظایف" : "مدیریت اسپرینت‌ها"}
          </h2>

          <p
            className="mt-1 text-xs leading-6"
            style={{ color: "var(--muted)" }}
          >
            {view === "GANTT"
              ? "هر نوار، بازه زمانی یک تسک واقعی را نشان می‌دهد و دایره کنار آن وضعیت فعلی تسک را مشخص می‌کند."
              : "اسپرینت‌ها را ایجاد، برنامه‌ریزی، شروع و پایان دهید و تسک‌ها را به آن‌ها اضافه کنید."}
          </p>
          {!canManage && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              همهٔ تسک‌های پروژه قابل مشاهده‌اند؛ تسک‌های دیگر اعضا در این صفحه فقط خواندنی هستند.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <PageGuide guide={pageGuides[view === "GANTT" ? "gantt" : "sprints"]} />
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            به‌روزرسانی
          </button>

          {canManage && view === "SPRINTS" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setSprintEditor("CREATE")}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 disabled:opacity-50"
              >
                <Plus size={17} />
                اسپرینت جدید
              </button>
          )}

          {canManage && view === "GANTT" && (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                تسک جدید
              </button>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      {view === "GANTT" && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="تسک‌های قابل مشاهده"
          value={displayedTasks.length}
          icon={<CalendarDays size={18} />}
        />
        <Stat
          label="در حال انجام"
          value={displayedTasks.filter(
            (task) => task.status === "IN_PROGRESS"
          ).length}
          icon={<Clock3 size={18} />}
        />
        <Stat
          label="تکمیل‌شده"
          value={completedCount}
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 p-4">
          <div>
            <h3 className="font-bold">
              تقویم زمان‌بندی تسک‌ها
            </h3>

            <p
              className="mt-2 text-xs"
              style={{ color: "var(--muted)" }}
            >
              {persianDate(rangeStart)}
              {" تا "}
              {persianDate(rangeEnd)}
              {view === "GANTT" && (
                <span className="mr-2 text-emerald-700">
                  (۳۵ روز گذشته تا ۳۴ روز آینده)
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="فیلتر اسپرینت"
              value={selectedSprint}
              onChange={(event) =>
                setSelectedSprint(event.target.value)
              }
              className="max-w-48 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs"
            >
              <option value="ALL">
                همه تسک‌ها
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

            <button
              type="button"
              aria-label="۲۱ روز قبل"
              onClick={() =>
                setAnchor(addDays(anchor, -21))
              }
              className="rounded-lg border border-emerald-200 p-2"
            >
              <ChevronRight size={17} />
            </button>

            <button
              type="button"
              onClick={() => setAnchor(todayIso())}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
            >
              امروز
            </button>

            <button
              type="button"
              aria-label="۲۱ روز بعد"
              onClick={() =>
                setAnchor(addDays(anchor, 21))
              }
              className="rounded-lg border border-emerald-200 p-2"
            >
              <ChevronLeft size={17} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 border-b border-emerald-100 px-4 py-3">
          {(Object.keys(statusLabels) as TaskStatus[]).map(
            (status) => (
              <span
                key={status}
                className="inline-flex items-center gap-2 text-xs"
                style={{ color: "var(--muted)" }}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor: statusColors[status],
                  }}
                />
                {statusLabels[status]}
              </span>
            )
          )}

          {activeSprints.length > 0 && (
            <>
              <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
              <span className="self-center text-xs font-bold text-slate-600">
                اسپرینت‌های فعال:
              </span>
              {activeSprints.map((sprint) => {
                const color = colorForSprint(sprint.id);
                const selected = selectedSprint === sprint.id;

                return (
                  <button
                    key={sprint.id}
                    type="button"
                    onClick={() => setSelectedSprint(selected ? "ALL" : sprint.id)}
                    title={selected ? "نمایش همهٔ تسک‌ها" : `نمایش تسک‌های ${sprint.name}`}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      selected
                        ? "border-slate-400 bg-slate-100 text-slate-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {sprint.name}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center gap-2">
            <LoaderCircle
              size={22}
              className="animate-spin text-emerald-600"
            />
            در حال بارگذاری...
          </div>
        ) : (
          <div
            className="grid max-h-[min(68vh,720px)] overflow-y-auto"
            style={{
              gridTemplateColumns:
                "minmax(220px, 320px) minmax(0, 1fr)",
            }}
          >
            {/* Task names */}
            <div className="border-l border-emerald-100 bg-white">
              <div className="flex h-[88px] items-center border-b border-emerald-100 px-4 text-sm font-bold">
                نام تسک و مسئول
              </div>

              {orderedTasks.map((task) => {
                const activeSprint = task.sprintId
                  ? activeSprintById.get(task.sprintId)
                  : undefined;

                return (
                  <div
                    key={task.id}
                    className="flex h-[90px] items-center justify-between gap-3 border-b border-emerald-100 px-4"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-xs font-bold"
                        title={task.title}
                      >
                        {task.title}
                      </p>

                      {activeSprint && (
                        <span
                          className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: colorForSprint(activeSprint.id),
                            backgroundColor: `${colorForSprint(activeSprint.id)}18`,
                          }}
                          title={`اسپرینت فعال: ${activeSprint.name}`}
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: colorForSprint(activeSprint.id) }}
                          />
                          <span className="truncate">{activeSprint.name}</span>
                        </span>
                      )}

                      <p
                        className={`${activeSprint ? "mt-1" : "mt-2"} truncate text-[11px]`}
                        style={{ color: "var(--muted)" }}
                      >
                        {task.assignee?.name ??
                          "بدون مسئول"}
                      </p>
                      {!canManage && task.assigneeId === actorId && (
                        <span className="mt-1 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          تسک شما
                        </span>
                      )}
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        title="تنظیم تاریخ تسک"
                        aria-label={`تنظیم تاریخ ${task.title}`}
                        onClick={() => openTaskDates(task)}
                        className="shrink-0 rounded-lg border border-emerald-100 px-2 py-1.5 text-[11px] text-emerald-700 hover:bg-emerald-50"
                      >
                        تاریخ
                      </button>
                    )}
                  </div>
                );
              })}

              {orderedTasks.length === 0 && (
                <p className="p-5 text-xs text-slate-500">
                  تسکی برای نمایش وجود ندارد.
                </p>
              )}
            </div>

            {/* Calendar */}
            <div
              ref={timelineScrollRef}
              className="min-w-0 overflow-x-auto"
              dir="ltr"
            >
              <div style={{ width: timelineWidth }}>
                <div className="flex h-[88px] border-b border-emerald-100">
                  {dates.map((date, index) => {
                    const month = persianDate(date, {
                      year: "numeric",
                      month: "long",
                    });

                    const newMonth =
                      index === 0 ||
                      month !==
                        persianDate(dates[index - 1], {
                          year: "numeric",
                          month: "long",
                        });

                    return (
                      <div
                        key={date}
                        className={`relative flex shrink-0 flex-col items-center justify-end border-r border-emerald-100 pb-2 ${
                          date === today
                            ? "bg-emerald-50"
                            : ""
                        }`}
                        style={{ width: dayWidth }}
                      >
                        {newMonth && (
                          <span
                            dir="rtl"
                            className="absolute left-1 top-2 whitespace-nowrap text-[10px] font-bold text-emerald-700"
                          >
                            {month}
                          </span>
                        )}

                        <strong className="text-xs">
                          {persianDate(date, {
                            day: "numeric",
                          })}
                        </strong>

                        <span className="mt-1 text-[10px] text-slate-400">
                          {persianDate(date, {
                            weekday: "short",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {orderedTasks.map((task) => {
                  const activeSprint = task.sprintId
                    ? activeSprintById.get(task.sprintId)
                    : undefined;
                  const currentDrag =
                    drag?.taskId === task.id
                      ? drag
                      : null;

                  const startDate =
                    currentDrag?.nextStart ??
                    task.startDate;

                  const dueDate =
                    currentDrag?.nextEnd ??
                    task.dueDate;

                  const scheduled = Boolean(
                    startDate && dueDate
                  );

                  const startIndex = scheduled
                    ? diffDays(
                        startDate!,
                        rangeStart
                      )
                    : 0;

                  const duration = scheduled
                    ? Math.max(
                        1,
                        diffDays(
                          dueDate!,
                          startDate!
                        ) + 1
                      )
                    : 0;

                  const visible =
                    scheduled &&
                    startIndex < visibleDays &&
                    startIndex + duration > 0;

                  return (
                    <div
                      key={task.id}
                      className="relative h-[90px] border-b border-emerald-100"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, var(--border) 1px, transparent 1px)",
                        backgroundSize: `${dayWidth}px 100%`,
                      }}
                    >
                      {todayIndex >= 0 &&
                        todayIndex < visibleDays && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-[1] w-[2px] bg-emerald-500/40"
                            style={{
                              left:
                                todayIndex * dayWidth +
                                dayWidth / 2,
                            }}
                          />
                        )}

                      {visible && (
                        <>
                          <div
                            className="absolute top-[25px] z-[3] flex size-6 items-center justify-center rounded-full border-[3px] border-white shadow-sm"
                            style={{
                              left:
                                startIndex * dayWidth - 29,
                              backgroundColor:
                                statusColors[task.status],
                            }}
                            title={statusLabels[task.status]}
                            aria-label={
                              `وضعیت: ${statusLabels[task.status]}`
                            }
                          >
                            {task.status === "DONE" && (
                              <CheckCircle2
                                size={13}
                                className="text-white"
                              />
                            )}
                          </div>

                          <div
                            className={`absolute top-[22px] z-[2] flex h-[34px] items-center rounded-lg text-white shadow-sm ${
                              canManage
                                ? "cursor-grab active:cursor-grabbing"
                                : "cursor-default"
                            }`}
                            style={{
                              left: startIndex * dayWidth,
                              width: duration * dayWidth,
                              backgroundColor:
                                statusColors[task.status],
                              touchAction: "none",
                              outline: currentDrag
                                ? "2px solid var(--primary)"
                                : "none",
                            }}
                            title={
                              `${task.title}\n` +
                              `${persianDate(startDate!)} تا ${persianDate(dueDate!)}\n` +
                              `وضعیت: ${statusLabels[task.status]}` +
                              (activeSprint
                                ? `\nاسپرینت فعال: ${activeSprint.name}`
                                : "")
                            }
                            onPointerDown={(event) => {
                              const target =
                                event.target as HTMLElement;

                              const mode =
                                target.closest(
                                  "[data-resize='start']"
                                )
                                  ? "start"
                                  : target.closest(
                                      "[data-resize='end']"
                                    )
                                    ? "end"
                                    : "move";

                              beginDrag(event, task, mode);
                            }}
                            onPointerMove={moveDrag}
                            onPointerUp={finishDrag}
                            onPointerCancel={cancelDrag}
                            onClick={() => {
                              if (!canManage) {
                                openTaskEditor(task);
                              }
                            }}
                          >
                            {canManage && (
                              <div
                                data-resize="start"
                                title="تغییر تاریخ شروع"
                                className="flex h-full w-3 shrink-0 cursor-ew-resize items-center justify-center rounded-l-lg bg-white/20"
                              >
                                <span className="h-5 w-[3px] rounded-full bg-white/80" />
                              </div>
                            )}

                            <span
                              dir="rtl"
                              className="min-w-0 flex-1 truncate px-2 text-center text-[11px] font-semibold"
                            >
                              {task.title}
                            </span>

                            {canManage && (
                              <div
                                data-resize="end"
                                title="تغییر تاریخ پایان"
                                className="flex h-full w-3 shrink-0 cursor-ew-resize items-center justify-center rounded-r-lg bg-white/20"
                              >
                                <span className="h-5 w-[3px] rounded-full bg-white/80" />
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {!scheduled && (
                        <div className="absolute inset-y-0 left-3 flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            بدون زمان‌بندی
                          </span>

                          {canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                openTaskDates(task)
                              }
                              className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                            >
                              تعیین تاریخ
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <p
        className="text-xs leading-7"
        style={{ color: "var(--muted)" }}
      >
        <strong>راهنما:</strong> دایره رنگی وضعیت
        هر تسک را نشان می‌دهد. وسط نوار را
        برای جابه‌جایی کل بازه بکشید؛ دو سر
        نوار برای کوتاه یا بلندکردن آن هستند.
        برای مشاهده تاریخ دقیق، نشانگر را
        روی نوار نگه دارید. برای تاریخ‌های
        خارج از بازه نمایشی، از دکمه‌های
        حرکت تقویم استفاده کنید.
      </p>

      </>}

      {view === "SPRINTS" && <section className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
        <h3 className="text-sm font-extrabold">
          مدیریت وظایف و اسپرینت‌ها
        </h3>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50/60 p-2.5">
          <p className="text-xs text-emerald-800">برای جلوگیری از شلوغی، تسک‌ها را جست‌وجو کنید و فقط اسپرینت موردنظر را باز کنید.</p>
          <form onSubmit={runSprintSearch} className="flex w-full max-w-md gap-2">
            <input value={sprintSearchInput} onChange={(event) => setSprintSearchInput(event.target.value)} placeholder="جست‌وجو در عنوان یا مسئول تسک..." className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-xs" />
            <button type="submit" className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
              <Search size={14} />
              جست‌وجو
            </button>
          </form>
        </div>

        {sprintSearch && searchMatchedSprintIds.length === 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            تسکی مطابق «{sprintSearchInput.trim()}» در هیچ اسپرینتی پیدا نشد.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {sprints.map((sprint) => {
            const sprintTasks = tasks.filter(
              (task) => task.sprintId === sprint.id
            );
            const visibleSprintTasks = sprintTasks.filter((task) =>
              task.title.toLocaleLowerCase("fa-IR").includes(sprintSearch.toLocaleLowerCase("fa-IR")) ||
              (task.assignee?.name ?? "").toLocaleLowerCase("fa-IR").includes(sprintSearch.toLocaleLowerCase("fa-IR"))
            );

            const closed =
              sprint.status === "COMPLETED" ||
              sprint.status === "CANCELLED";

            const canPlan =
              canManage && sprint.status === "FUTURE";

            const expanded =
              expandedSprints.includes(sprint.id);

            return (
              <div
                key={sprint.id}
                className="overflow-hidden rounded-lg border border-emerald-100"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedSprints((current) =>
                        current.includes(sprint.id)
                          ? current.filter((id) => id !== sprint.id)
                          : [...current, sprint.id]
                      );
                      setSelectedTaskId("");
                    }}
                    className="flex min-w-0 items-center gap-2 text-right"
                  >
                    <ChevronDown
                      size={17}
                      className={
                        expanded ? "rotate-180" : ""
                      }
                    />

                    <span className="font-semibold">
                      {sprint.name}
                    </span>

                    <span className="text-xs text-slate-400">
                      {sprintTasks.length.toLocaleString(
                        "fa-IR"
                      )}{" "}
                      تسک
                    </span>

                    <span className="text-xs text-slate-400">
                      {sprint.startDate && sprint.endDate
                        ? `${persianDate(sprint.startDate)} تا ${persianDate(sprint.endDate)}`
                        : "بدون بازه زمانی"}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {sprintLabels[sprint.status]}
                    </span>

                    {canManage && sprint.status === "FUTURE" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setSprintEditor(sprint)}
                          className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                        >
                          ویرایش
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startSprint(sprint)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          شروع اسپرینت
                        </button>
                      </>
                    )}

                    {canManage && sprint.status === "ACTIVE" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEndingSprint(sprint)}
                        className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        پایان اسپرینت
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`حذف ${sprint.name}`}
                        onClick={() =>
                          setDeletingSprint(sprint.id)
                        }
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-2 border-t border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="rounded-xl border border-emerald-100 bg-white p-3 text-sm">
                      <p className="text-xs font-semibold text-emerald-800">
                        هدف اسپرینت
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">
                        {sprint.goal || "هدف اسپرینت ثبت نشده است."}
                      </p>
                    </div>

                    {sprint.startSnapshot && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-emerald-100/70 p-3 text-sm text-emerald-900">
                          تسک‌های برنامه‌ریزی‌شده: {sprint.startSnapshot.plannedTaskCount.toLocaleString("fa-IR")}
                        </div>
                        <div className="rounded-xl bg-emerald-100/70 p-3 text-sm text-emerald-900">
                          Story Points برنامه‌ریزی‌شده: {sprint.startSnapshot.plannedStoryPoints.toLocaleString("fa-IR")}
                        </div>
                      </div>
                    )}

                    {sprint.endSnapshot && (
                      <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-violet-950">گزارش نهایی اسپرینت</p>
                          <span className="text-xs text-violet-700">ثبت‌شده در {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(sprint.endSnapshot.endedAt))}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-lg bg-white/80 p-2 text-violet-900">برنامه: {sprint.endSnapshot.plannedTaskCount.toLocaleString("fa-IR")} تسک · {sprint.endSnapshot.plannedStoryPoints.toLocaleString("fa-IR")} SP</div>
                          <div className="rounded-lg bg-emerald-100/70 p-2 text-emerald-900">انجام‌شده: {sprint.endSnapshot.completedTaskCount.toLocaleString("fa-IR")} تسک · {sprint.endSnapshot.completedStoryPoints.toLocaleString("fa-IR")} SP</div>
                          <div className="rounded-lg bg-amber-100/70 p-2 text-amber-900">ناتمام: {sprint.endSnapshot.incompleteTaskCount.toLocaleString("fa-IR")} تسک · {sprint.endSnapshot.incompleteStoryPoints.toLocaleString("fa-IR")} SP</div>
                        </div>
                      </div>
                    )}

                    {visibleSprintTasks.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {sprintSearch
                          ? "تسکی مطابق جست‌وجو در این اسپرینت پیدا نشد."
                          : "هنوز تسکی به این اسپرینت اضافه نشده است."}
                      </p>
                    ) : (
                      visibleSprintTasks.slice(0, 20).map((task) => (
                        <div
                          key={task.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="size-3 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  statusColors[task.status],
                              }}
                            />

                            <div>
                              <p className="text-sm font-semibold">
                                {task.title}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {statusLabels[task.status]}
                                {" · "}
                                {task.assignee?.name ??
                                  "بدون مسئول"}
                              </p>
                            </div>
                          </div>

                          {canPlan && !closed && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                removeTaskFromSprint(
                                  sprint.id,
                                  task.id
                                )
                              }
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs text-emerald-700 disabled:opacity-50"
                            >
                              خارج کردن
                            </button>
                          )}
                        </div>
                      ))
                    )}

                    {visibleSprintTasks.length > 20 && (
                      <p className="rounded-lg bg-white p-3 text-center text-xs text-slate-500">برای حفظ خوانایی، ۲۰ تسک اول نمایش داده شد؛ با جست‌وجو به تسک موردنظر برسید.</p>
                    )}

                    {canPlan && !closed && (
                      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
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
                            انتخاب تسک خارج از اسپرینت
                          </option>

                          {unassignedTasks.map((task) => (
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
                            addTaskToSprint(sprint.id)
                          }
                          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          افزودن تسک
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && sprints.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              هنوز اسپرینتی ایجاد نشده است.
            </p>
          )}
        </div>
      </section>
      }

      {/* Task details */}
      {editingTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-details-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3
                  id="task-details-title"
                  className="text-lg font-extrabold"
                >
                  مشخصات تسک
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {canManage
                    ? "اطلاعات موردنیاز را ویرایش و ذخیره کنید."
                    : "مشخصات این تسک"}
                </p>
              </div>

              <button
                type="button"
                aria-label="بستن"
                disabled={busy}
                onClick={() => setEditingTask(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={saveTaskForm}
              className="mt-6 space-y-5"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  عنوان
                </span>
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={taskTitle}
                  disabled={!canManage || busy}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  توضیحات
                </span>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={taskDescription}
                  disabled={!canManage || busy}
                  onChange={(event) =>
                    setTaskDescription(event.target.value)
                  }
                  className={inputClass}
                />
              </label>

              <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-extrabold text-violet-950">اطلاعات کامل تسک</h4>
                  {taskDetailLoading && <LoaderCircle size={16} className="animate-spin text-violet-600" />}
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <Info label="نوع کار" value={editingTask.type} />
                  <Info label="Story Points" value={editingTask.storyPoints === null ? "بدون برآورد" : editingTask.storyPoints.toLocaleString("fa-IR")} />
                  <Info label="Backlog Rank" value={editingTask.rank.toLocaleString("fa-IR")} />
                  <Info label="Epic" value={taskDetail?.epic?.name ?? "بدون Epic"} />
                  <Info label="تسک والد" value={taskDetail?.parentTask?.title ?? "آیتم سطح اول"} />
                  <Info label="مسئول" value={editingTask.assignee?.name ?? "بدون مسئول"} />
                </div>
                {editingTask.acceptanceCriteria && <div className="mt-3 rounded-xl bg-white/80 p-3"><p className="text-xs font-bold text-violet-800">معیارهای پذیرش</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{editingTask.acceptanceCriteria}</p></div>}
                {taskDetail && taskDetail.subtasks.length > 0 && <div className="mt-3"><p className="text-xs font-bold text-violet-800">زیرتسک‌ها ({taskDetail.subtasks.length.toLocaleString("fa-IR")})</p><ul className="mt-2 space-y-1.5">{taskDetail.subtasks.map((subtask) => <li key={subtask.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-700"><span className="font-semibold">{subtask.title}</span><span>{subtask.type} · {statusLabels[subtask.status]} · {subtask.storyPoints ?? "—"} SP</span></li>)}</ul></div>}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    وضعیت
                  </span>
                  <select
                    value={taskStatus}
                    disabled={!canManage || busy}
                    onChange={(event) =>
                      setTaskStatus(event.target.value as TaskStatus)
                    }
                    className={inputClass}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    اولویت
                  </span>
                  <select
                    value={taskPriority}
                    disabled={!canManage || busy}
                    onChange={(event) =>
                      setTaskPriority(event.target.value as Priority)
                    }
                    className={inputClass}
                  >
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PersianDatePicker
                  label="تاریخ شروع تسک"
                  value={taskStart}
                  onChange={setTaskStart}
                  disabled={!canManage || busy}
                />

                <PersianDatePicker
                  label="تاریخ پایان تسک"
                  value={taskEnd}
                  onChange={setTaskEnd}
                  disabled={!canManage || busy}
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
                >
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-emerald-100 pt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setEditingTask(null)
                  }
                  className="rounded-xl border border-emerald-200 px-5 py-3 text-sm"
                >
                  بستن
                </button>

                {canManage && (
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    ذخیره تغییرات
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create task */}
      {creating && (
        <TaskFormModal
          title="ایجاد وظیفه جدید"
          submitLabel="ثبت وظیفه"
          assignees={assignees}
          onClose={() => setCreating(false)}
          onSubmit={createTask}
        />
      )}

      {sprintEditor && (
        <SprintFormModal
          sprint={
            sprintEditor === "CREATE" ? null : sprintEditor
          }
          existingSprints={sprints}
          busy={busy}
          onClose={() => setSprintEditor(null)}
          onSubmit={saveSprint}
        />
      )}

      {endingSprint && (
        <SprintEndModal
          sprint={endingSprint}
          tasks={tasks.filter((task) => task.sprintId === endingSprint.id)}
          destinationSprints={sprints.filter((sprint) => sprint.id !== endingSprint.id && (sprint.status === "FUTURE" || sprint.status === "ACTIVE"))}
          busy={busy}
          onClose={() => setEndingSprint(null)}
          onConfirm={(unfinishedDestinationSprintId) =>
            endSprint(endingSprint, unfinishedDestinationSprintId)
          }
        />
      )}

      {deletingSprint && (
        <ConfirmDialog
          title="حذف اسپرینت"
          description="اسپرینت حذف می‌شود ولی تسک‌های آن باقی می‌مانند."
          busy={busy}
          onCancel={() =>
            setDeletingSprint(null)
          }
          onConfirm={deleteSprint}
        />
      )}
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
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <div>
        <p
          className="text-xs"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </p>

        <p className="mt-1 text-xl font-extrabold">
          {value.toLocaleString("fa-IR")}
        </p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 p-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-800" title={value}>{value}</p>
    </div>
  );
}
