"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleDot,
  FolderTree,
  GitBranch,
  LoaderCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import PageGuide from "@/components/ui/page-guide";
import { pageGuides } from "@/lib/page-guides";

type TaskType = "STORY" | "TASK" | "BUG";
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type Task = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  storyPoints: number | null;
  parentTaskId: string | null;
  _count: { subtasks: number };
};
type Epic = {
  id: string;
  name: string;
  description: string | null;
  tasks: Task[];
  _count: { tasks: number };
};
type Response = { canManage: boolean; epics: Epic[] };

const taskTypeLabels: Record<TaskType, string> = {
  STORY: "Story",
  TASK: "Task",
  BUG: "Bug",
};
const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: "در انتظار",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در بازبینی",
  DONE: "انجام‌شده",
};
const taskStatusColors: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  IN_REVIEW: "bg-amber-50 text-amber-800",
  DONE: "bg-emerald-50 text-emerald-700",
};

export default function EpicsWorkspace({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/epics`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "دریافت اپیک‌ها ناموفق بود.");
      setData(body);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطایی رخ داد.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const taskCount = useMemo(
    () => data?.epics.reduce((total, epic) => total + epic._count.tasks, 0) ?? 0,
    [data],
  );

  async function createEpic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setError("نام اپیک باید حداقل ۳ کاراکتر باشد.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/epics`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: description.trim() || null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "ایجاد اپیک ناموفق بود.");
      setName("");
      setDescription("");
      setShowCreate(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطایی رخ داد.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin text-indigo-600" size={20} />در حال دریافت اپیک‌ها...</div>;
  }

  return (
    <div dir="rtl" className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-700"><FolderTree size={15} />ساختار محصول</p>
          <h1 className="mt-1 text-lg font-extrabold text-[var(--foreground)]">اپیک‌ها و درخت وظایف</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">هر اپیک، تسک‌های اصلی و زیرتسک‌های وابسته را در یک ساختار روشن نشان می‌دهد.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PageGuide guide={pageGuides.epics} />
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />به‌روزرسانی</button>
          {data?.canManage && <button type="button" onClick={() => { setShowCreate((value) => !value); setError(""); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700"><Plus size={15} />اپیک جدید</button>}
        </div>
      </header>

      {data && !data.canManage && (
        <p className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs font-semibold text-indigo-800">
          همهٔ Epicها و تسک‌های مرتبط قابل مشاهده‌اند؛ ایجاد یا مدیریت Epic فقط برای مدیر پروژه امکان‌پذیر است.
        </p>
      )}

      <section aria-label="آمار اپیک‌ها" className="grid grid-cols-2 gap-2 sm:max-w-md">
        <Metric label="تعداد اپیک" value={data?.epics.length ?? 0} />
        <Metric label="تسک‌های متصل" value={taskCount} tone="indigo" />
      </section>

      {showCreate && data?.canManage && (
        <form onSubmit={createEpic} className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div><h2 className="text-sm font-extrabold text-indigo-950">ایجاد اپیک جدید</h2><p className="mt-1 text-xs text-indigo-800">اپیک یک هدف یا بخش بزرگ از محصول است که چند تسک را کنار هم نگه می‌دارد.</p></div>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-700">نام اپیک</span><input autoFocus required minLength={3} maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="min-h-10 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" placeholder="مثلاً: راه‌اندازی پنل مشتریان" /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-700">توضیحات (اختیاری)</span><textarea value={description} maxLength={2000} rows={3} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm" placeholder="خروجی یا هدف این اپیک را توضیح دهید..." /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} disabled={saving} className="min-h-10 rounded-lg px-3 text-xs font-bold text-indigo-800 hover:bg-indigo-100">انصراف</button><button disabled={saving} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white disabled:opacity-50">{saving && <LoaderCircle size={14} className="animate-spin" />}ایجاد اپیک</button></div>
        </form>
      )}

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}

      {!data?.epics.length ? (
        <section className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-12 text-center"><FolderTree className="mx-auto text-indigo-500" size={28} /><h2 className="mt-3 text-sm font-extrabold text-indigo-950">هنوز اپیکی ثبت نشده است</h2><p className="mx-auto mt-1 max-w-md text-xs leading-6 text-indigo-800">برای گروه‌بندی هدف‌های بزرگ، یک اپیک بسازید و سپس هنگام ایجاد یا ویرایش تسک، آن را به اپیک متصل کنید.</p></section>
      ) : (
        <div className="space-y-3">
          {data.epics.map((epic) => <EpicTree key={epic.id} epic={epic} />)}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "emerald" }: { label: string; value: number; tone?: "emerald" | "indigo" }) {
  return <div className={`rounded-xl border px-3 py-2.5 ${tone === "indigo" ? "border-indigo-100 bg-indigo-50/50" : "border-emerald-100 bg-emerald-50/50"}`}><p className="text-[11px] font-semibold text-[var(--muted)]">{label}</p><p className="mt-0.5 text-lg font-extrabold tabular-nums text-[var(--foreground)]">{value.toLocaleString("fa-IR")}</p></div>;
}

function EpicTree({ epic }: { epic: Epic }) {
  const parents = epic.tasks.filter((task) => !task.parentTaskId);
  const childrenFor = (parentId: string) => epic.tasks.filter((task) => task.parentTaskId === parentId);

  return (
    <details open className="group overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 bg-indigo-50/55 px-4 py-3.5 marker:content-none sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm"><FolderTree size={17} /></span><div className="min-w-0"><h2 className="truncate text-sm font-extrabold text-indigo-950">{epic.name}</h2><p className="mt-0.5 text-[11px] text-indigo-700">{epic._count.tasks.toLocaleString("fa-IR")} تسک متصل</p></div></div><ChevronDown size={18} className="shrink-0 text-indigo-600 transition group-open:rotate-180" /></summary>
      <div className="p-4 sm:p-5">
        {epic.description && <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">{epic.description}</p>}
        {!parents.length ? <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--muted)]">هنوز تسکی به این اپیک متصل نشده است.</p> : <div className="mr-1 space-y-3 border-r-2 border-indigo-100 pr-4">{parents.map((task) => <TaskBranch key={task.id} task={task} childTasks={childrenFor(task.id)} />)}</div>}
      </div>
    </details>
  );
}

function TaskBranch({ task, childTasks }: { task: Task; childTasks: Task[] }) {
  return <div className="relative before:absolute before:right-[-18px] before:top-5 before:h-px before:w-4 before:bg-indigo-200"><TaskNode task={task} />{childTasks.length > 0 && <div className="mr-5 mt-2 space-y-2 border-r-2 border-sky-100 pr-4">{childTasks.map((child) => <div key={child.id} className="relative before:absolute before:right-[-18px] before:top-5 before:h-px before:w-4 before:bg-sky-200"><TaskNode task={child} isSubtask /></div>)}</div>}</div>;
}

function TaskNode({ task, isSubtask = false }: { task: Task; isSubtask?: boolean }) {
  return <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${isSubtask ? "border-sky-100 bg-sky-50/40" : "border-emerald-100 bg-emerald-50/35"}`}><div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><GitBranch size={14} className={isSubtask ? "text-sky-600" : "text-emerald-600"} />{task.title}</p><p className="mt-1 text-[11px] text-slate-500">{isSubtask ? "زیرتسک" : "تسک اصلی"} · {taskTypeLabels[task.type]} · {task.storyPoints ?? "—"} SP {task._count.subtasks > 0 ? `· ${task._count.subtasks.toLocaleString("fa-IR")} زیرتسک` : ""}</p></div><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${taskStatusColors[task.status]}`}><CircleDot size={11} />{taskStatusLabels[task.status]}</span></div>;
}
