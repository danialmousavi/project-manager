"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";

type TaskType = "STORY" | "TASK" | "BUG";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Task = { id: string; title: string; description: string | null; acceptanceCriteria: string | null; type: TaskType; storyPoints: number | null; rank: number; priority: Priority; status: string; sprintId: string | null; assignee: { id: string; name: string } | null };
type Sprint = { id: string; name: string; goal: string | null; status: "ACTIVE" | "FUTURE"; tasks: Task[]; storyPoints: number };
type Data = { canManage: boolean; activeSprint: Sprint | null; futureSprints: Sprint[]; backlog: Task[]; backlogStoryPoints: number };

const typeLabel: Record<TaskType, string> = { STORY: "Story", TASK: "Task", BUG: "Bug" };
const priorityLabel: Record<Priority, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "زیاد", URGENT: "فوری" };

export default function BacklogBoard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assigneeId) params.set("assigneeId", assigneeId);
      if (type) params.set("type", type);
      if (priority) params.set("priority", priority);
      const response = await fetch(`/api/v1/projects/${projectId}/backlog?${params}`, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "دریافت بک‌لاگ ناموفق بود.");
      setData(body);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "خطایی رخ داد."); }
    finally { setLoading(false); }
  }, [assigneeId, priority, projectId, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sprints = useMemo(() => [data?.activeSprint, ...(data?.futureSprints ?? [])].filter(Boolean) as Sprint[], [data]);
  const allTasks = useMemo(() => [...(data?.backlog ?? []), ...sprints.flatMap((sprint) => sprint.tasks)], [data, sprints]);
  const assignees = useMemo(() => Array.from(new Map(allTasks.filter((task) => task.assignee).map((task) => [task.assignee!.id, task.assignee!])).values()), [allTasks]);

  async function patch(body: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/backlog`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ذخیره تغییر ناموفق بود.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "خطایی رخ داد."); }
    finally { setBusy(false); setDragged(null); }
  }

  async function quickCreate(event: React.FormEvent) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (title.length < 3) return setError("عنوان تسک باید حداقل ۳ کاراکتر باشد.");
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/tasks`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description: "", type: "TASK", storyPoints: null, rank: 0, acceptanceCriteria: null, priority: "MEDIUM", status: "TODO", assigneeId: null, startDate: null, dueDate: null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ایجاد تسک ناموفق بود.");
      setQuickTitle(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "خطایی رخ داد."); }
    finally { setBusy(false); }
  }

  if (loading && !data) return <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin text-emerald-600" />در حال دریافت بک‌لاگ...</div>;

  return <div dir="rtl" className="space-y-3">
    <header className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-extrabold">Product Backlog</h2><p className="mt-0.5 text-xs text-slate-500">برنامه‌ریزی و اولویت‌بندی تسک‌های پروژه</p></div><button onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"><RefreshCw size={14} />به‌روزرسانی</button></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-2 rounded-xl border border-emerald-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در تسک‌ها..." className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs" /><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs"><option value="">همه مسئول‌ها</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs"><option value="">همه نوع‌ها</option>{Object.entries(typeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs"><option value="">همه اولویت‌ها</option>{Object.entries(priorityLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {data?.canManage && <form onSubmit={quickCreate} className="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-white p-3"><input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} maxLength={200} placeholder="ایجاد سریع تسک در بک‌لاگ..." className="min-w-52 flex-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs" /><button disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Plus size={14} />افزودن تسک</button></form>}
    {data?.activeSprint && <SprintSection sprint={data.activeSprint} search={search} canManage={data.canManage} busy={busy} dragged={dragged} onDrag={setDragged} onOpen={setSelectedTask} onDrop={(taskId) => void patch({ action: "MOVE_TASK", taskId, sprintId: data.activeSprint!.id })} onMove={(taskId, sprintId) => void patch({ action: "MOVE_TASK", taskId, sprintId })} onRank={(taskId, rank) => void patch({ action: "REORDER_TASK", taskId, rank })} />}
    {data?.futureSprints.map((sprint) => <SprintSection key={sprint.id} sprint={sprint} search={search} canManage={data.canManage} busy={busy} dragged={dragged} onDrag={setDragged} onOpen={setSelectedTask} onDrop={(taskId) => void patch({ action: "MOVE_TASK", taskId, sprintId: sprint.id })} onMove={(taskId, sprintId) => void patch({ action: "MOVE_TASK", taskId, sprintId })} onRank={(taskId, rank) => void patch({ action: "REORDER_TASK", taskId, rank })} />)}
    <section onDragOver={(event) => data?.canManage && event.preventDefault()} onDrop={() => dragged && void patch({ action: "MOVE_TASK", taskId: dragged, sprintId: null })} className="rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-3"><div className="mb-2 flex justify-between"><h3 className="text-sm font-extrabold text-violet-950">Backlog برنامه‌ریزی‌نشده</h3><span className="text-[11px] text-violet-700">{data?.backlog.length.toLocaleString("fa-IR")} تسک · {data?.backlogStoryPoints.toLocaleString("fa-IR")} SP</span></div><TaskList search={search} tasks={data?.backlog ?? []} canManage={Boolean(data?.canManage)} busy={busy} dragged={dragged} sprints={sprints} onDrag={setDragged} onOpen={setSelectedTask} onMove={(taskId, sprintId) => void patch({ action: "MOVE_TASK", taskId, sprintId })} onRank={(taskId, rank) => void patch({ action: "REORDER_TASK", taskId, rank })} /></section>
    {selectedTask && <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
  </div>;
}

function SprintSection({ sprint, search, canManage, busy, dragged, onDrag, onOpen, onDrop, onMove, onRank }: { sprint: Sprint; search: string; canManage: boolean; busy: boolean; dragged: string | null; onDrag: (id: string | null) => void; onOpen: (task: Task) => void; onDrop: (id: string) => void; onMove: (taskId: string, sprintId: string | null) => void; onRank: (taskId: string, rank: number) => void }) {
  return <section onDragOver={(event) => canManage && event.preventDefault()} onDrop={() => dragged && onDrop(dragged)} className={`rounded-xl border p-3 ${sprint.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50/60" : "border-sky-200 bg-sky-50/60"}`}><div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-extrabold">{sprint.status === "ACTIVE" ? "Sprint فعال" : "Sprint آینده"}: {sprint.name}</h3>{sprint.goal && <p className="mt-0.5 text-[11px] text-slate-500">{sprint.goal}</p>}</div><span className="rounded-md bg-white/80 px-2 py-1 text-[11px] text-emerald-800">{sprint.tasks.length.toLocaleString("fa-IR")} تسک · {sprint.storyPoints.toLocaleString("fa-IR")} SP</span></div><TaskList search={search} tasks={sprint.tasks} canManage={canManage} busy={busy} dragged={dragged} sprints={[sprint]} onDrag={onDrag} onOpen={onOpen} onMove={onMove} onRank={onRank} /></section>;
}

function TaskList({ tasks, search, canManage, busy, dragged, sprints, onDrag, onOpen, onMove, onRank }: { tasks: Task[]; search: string; canManage: boolean; busy: boolean; dragged: string | null; sprints: Sprint[]; onDrag: (id: string | null) => void; onOpen: (task: Task) => void; onMove: (taskId: string, sprintId: string | null) => void; onRank: (taskId: string, rank: number) => void }) {
  const [limit, setLimit] = useState(20);
  const visible = tasks.filter((task) => task.title.toLocaleLowerCase("fa-IR").includes(search.toLocaleLowerCase("fa-IR")) || (task.assignee?.name ?? "").toLocaleLowerCase("fa-IR").includes(search.toLocaleLowerCase("fa-IR")));
  const shown = visible.slice(0, limit);
  if (!visible.length) return <p className="py-5 text-sm text-slate-500">تسکی مطابق فیلتر یا جست‌وجو وجود ندارد.</p>;
  return <div className="space-y-1.5">{shown.map((task) => <article key={task.id} draggable={canManage && !busy} onDragStart={() => onDrag(task.id)} onDragEnd={() => onDrag(null)} onClick={() => onOpen(task)} className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border bg-white px-2.5 py-2 transition hover:border-emerald-300 hover:shadow-sm ${dragged === task.id ? "opacity-50" : ""}`}><GripVertical size={14} className="text-slate-400" /><div className="min-w-40 flex-1"><p className="text-sm font-semibold">{task.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{typeLabel[task.type]} · {priorityLabel[task.priority]} · {task.storyPoints ?? "—"} SP · {task.assignee?.name ?? "بدون مسئول"}</p></div>{canManage && <><input aria-label={`رتبه ${task.title}`} type="number" min="0" max="100000" defaultValue={task.rank} onClick={(event) => event.stopPropagation()} onBlur={(event) => { const rank = Number(event.target.value); if (Number.isFinite(rank) && rank !== task.rank) onRank(task.id, rank); }} className="w-20 rounded-md border px-1.5 py-1 text-[11px]" /><select value={task.sprintId ?? ""} disabled={busy} onClick={(event) => event.stopPropagation()} onChange={(event) => onMove(task.id, event.target.value || null)} className="max-w-32 rounded-md border px-1.5 py-1 text-[11px]"><option value="">Backlog</option>{sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></>}</article>)}{visible.length > shown.length && <button type="button" onClick={() => setLimit((value) => value + 20)} className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700">نمایش ۲۰ تسک دیگر ({(visible.length - shown.length).toLocaleString("fa-IR")})</button>}</div>;
}

function TaskDetailsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={onClose}><div dir="rtl" role="dialog" aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 text-[11px]"><span className="rounded bg-violet-100 px-2 py-1 text-violet-800">{typeLabel[task.type]}</span><span className="rounded bg-amber-100 px-2 py-1 text-amber-800">{priorityLabel[task.priority]}</span></div><h3 className="mt-2 text-lg font-extrabold">{task.title}</h3></div><button type="button" aria-label="بستن" onClick={onClose}><X size={19} /></button></div><div className="mt-5 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">Story Points</span><p className="mt-1 font-bold">{task.storyPoints ?? "بدون برآورد"}</p></div><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">مسئول</span><p className="mt-1 font-bold">{task.assignee?.name ?? "بدون مسئول"}</p></div></div><section className="mt-4"><h4 className="text-sm font-bold">توضیحات</h4><p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-7 text-slate-700">{task.description || "توضیحی ثبت نشده است."}</p></section>{task.acceptanceCriteria && <section className="mt-4"><h4 className="text-sm font-bold">Acceptance Criteria</h4><p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm leading-7 text-emerald-950">{task.acceptanceCriteria}</p></section>}</div></div>;
}
