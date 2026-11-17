"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderTree, GripVertical, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";

import { TaskFormModal, type FormValues, type MilestoneOption } from "@/components/tasks/project-tasks";
import PageGuide from "@/components/ui/page-guide";
import { pageGuides } from "@/lib/page-guides";

type TaskType = "STORY" | "TASK" | "BUG";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Task = { id: string; title: string; description: string | null; acceptanceCriteria: string | null; type: TaskType; storyPoints: number | null; rank: number; priority: Priority; status: string; sprintId: string | null; epicId: string | null; parentTaskId: string | null; epic: { id: string; name: string } | null; parentTask: { id: string; title: string } | null; _count: { subtasks: number }; assignee: { id: string; name: string } | null };
type Sprint = { id: string; name: string; goal: string | null; status: "ACTIVE" | "FUTURE"; tasks: Task[]; storyPoints: number };
type Data = { canManage: boolean; activeSprints: Sprint[]; futureSprints: Sprint[]; backlog: Task[]; backlogStoryPoints: number };
type TreeTask = { id: string; title: string; type: TaskType; status: string; storyPoints: number | null; parentTaskId: string | null; _count: { subtasks: number } };
type Epic = { id: string; name: string; description: string | null; tasks: TreeTask[]; _count: { tasks: number } };

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
  const [epicId, setEpicId] = useState("");
  const [epics, setEpics] = useState<Epic[]>([]);
  const [milestones, setMilestones] = useState<MilestoneOption[]>([]);
  const [newEpicName, setNewEpicName] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assigneeId) params.set("assigneeId", assigneeId);
      if (type) params.set("type", type);
      if (priority) params.set("priority", priority);
      if (epicId) params.set("epicId", epicId);
      const [response, epicsResponse, milestonesResponse] = await Promise.all([fetch(`/api/v1/projects/${projectId}/backlog?${params}`, { cache: "no-store", credentials: "same-origin" }), fetch(`/api/v1/projects/${projectId}/epics`, { cache: "no-store", credentials: "same-origin" }), fetch(`/api/v1/projects/${projectId}/milestones`, { cache: "no-store", credentials: "same-origin" })]);
      const [body, epicsBody, milestonesBody] = await Promise.all([response.json(), epicsResponse.json(), milestonesResponse.json()]);
      if (!response.ok) throw new Error(body.message || "دریافت بک‌لاگ ناموفق بود.");
      setData(body);
      if (epicsResponse.ok) setEpics(epicsBody.epics ?? []);
      if (milestonesResponse.ok) setMilestones(milestonesBody.milestones ?? []);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "خطایی رخ داد."); }
    finally { setLoading(false); }
  }, [assigneeId, epicId, priority, projectId, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sprints = useMemo(() => [...(data?.activeSprints ?? []), ...(data?.futureSprints ?? [])], [data]);
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

  async function createEpic(event: React.FormEvent) {
    event.preventDefault();
    const name = newEpicName.trim();
    if (name.length < 3) return setError("نام Epic باید حداقل ۳ کاراکتر باشد.");
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/epics`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: null }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "ایجاد Epic ناموفق بود.");
      setNewEpicName("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "خطایی رخ داد."); }
    finally { setBusy(false); }
  }

  function dropOnTask(taskId: string, target: Task) {
    const source = allTasks.find((task) => task.id === taskId);
    if (!source || source.id === target.id) return;
    const rank = target.rank > 0 ? target.rank - 0.5 : target.rank + 0.5;
    void patch({
      action: "MOVE_AND_REORDER",
      taskId: source.id,
      sprintId: target.sprintId,
      rank,
    });
  }

  if (loading && !data) return <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin text-emerald-600" />در حال دریافت بک‌لاگ...</div>;

  return <div dir="rtl" className="space-y-3">
    <header className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-extrabold">Product Backlog</h2><p className="mt-0.5 text-xs text-slate-500">برنامه‌ریزی و اولویت‌بندی تسک‌های پروژه</p></div><div className="flex flex-wrap items-center justify-end gap-2"><PageGuide guide={pageGuides.backlog} /><button type="button" onClick={() => setTreeOpen(true)} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50"><FolderTree size={15} />درختچه کارها</button><button onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"><RefreshCw size={14} />به‌روزرسانی</button></div></header>
    <section className="grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50/45 p-3 text-xs text-indigo-950 sm:grid-cols-3"><div className="flex gap-2"><FolderTree size={16} className="mt-0.5 shrink-0 text-indigo-600" /><span><strong>Epic</strong><br />هدف یا بخش بزرگ کار؛ چند تسک مرتبط را کنار هم نگه می‌دارد.</span></div><div><strong>تسک / Story / Bug</strong><br />آیتم اصلی قابل برنامه‌ریزی و قابل انتقال به Sprint است.</div><div><strong>Subtask</strong><br />گام اجراییِ یک تسک است؛ فقط یک سطح زیرِ تسک والد دارد.</div></section>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {data?.canManage && <form onSubmit={createEpic} className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><span className="text-xs font-bold text-indigo-900">Epic جدید</span><input value={newEpicName} onChange={(event) => setNewEpicName(event.target.value)} maxLength={150} placeholder="مثلاً: نسخه اول محصول" className="min-w-48 flex-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs" /><button disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">ایجاد Epic</button></form>}
    <div className="grid gap-2 rounded-xl border border-emerald-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در تسک‌ها..." className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs" /><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs"><option value="">همه مسئول‌ها</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs"><option value="">همه نوع‌ها</option>{Object.entries(typeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs"><option value="">همه اولویت‌ها</option>{Object.entries(priorityLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={epicId} onChange={(event) => setEpicId(event.target.value)} className="rounded-lg border border-indigo-200 bg-indigo-50/40 px-2.5 py-1.5 text-xs"><option value="">همه Epicها</option>{epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.name}</option>)}</select></div>
    {data?.canManage && <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-teal-50 p-3"><div><p className="text-sm font-extrabold text-emerald-950">تسک جدید</p><p className="mt-0.5 text-xs text-emerald-700">فرم کامل تسک را باز کنید و جزئیات را همان‌جا مشخص کنید.</p></div><button type="button" disabled={busy} onClick={() => setTaskModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-900/15 hover:bg-emerald-700 disabled:opacity-50"><Plus size={15} />ایجاد سریع تسک</button></section>}
    {data?.activeSprints.map((sprint) => <SprintSection key={sprint.id} sprint={sprint} search={search} sprints={sprints} canManage={data.canManage} busy={busy} dragged={dragged} onDrag={setDragged} onOpen={setSelectedTask} onDropTask={dropOnTask} onDrop={(taskId) => void patch({ action: "MOVE_TASK", taskId, sprintId: sprint.id })} onMove={(taskId, sprintId) => void patch({ action: "MOVE_TASK", taskId, sprintId })} onRank={(taskId, rank) => void patch({ action: "REORDER_TASK", taskId, rank })} />)}
    {data?.futureSprints.map((sprint) => <SprintSection key={sprint.id} sprint={sprint} search={search} sprints={sprints} canManage={data.canManage} busy={busy} dragged={dragged} onDrag={setDragged} onOpen={setSelectedTask} onDropTask={dropOnTask} onDrop={(taskId) => void patch({ action: "MOVE_TASK", taskId, sprintId: sprint.id })} onMove={(taskId, sprintId) => void patch({ action: "MOVE_TASK", taskId, sprintId })} onRank={(taskId, rank) => void patch({ action: "REORDER_TASK", taskId, rank })} />)}
    <section onDragOver={(event) => data?.canManage && event.preventDefault()} onDrop={() => dragged && void patch({ action: "MOVE_TASK", taskId: dragged, sprintId: null })} className="rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-3"><div className="mb-2 flex justify-between"><h3 className="text-sm font-extrabold text-violet-950">Backlog برنامه‌ریزی‌نشده</h3><span className="text-[11px] text-violet-700">{data?.backlog.length.toLocaleString("fa-IR")} تسک · {data?.backlogStoryPoints.toLocaleString("fa-IR")} SP</span></div><TaskList search={search} tasks={data?.backlog ?? []} canManage={Boolean(data?.canManage)} busy={busy} dragged={dragged} sprints={sprints} onDrag={setDragged} onOpen={setSelectedTask} onDropTask={dropOnTask} onMove={(taskId, sprintId) => void patch({ action: "MOVE_TASK", taskId, sprintId })} onRank={(taskId, rank) => void patch({ action: "REORDER_TASK", taskId, rank })} /></section>
    {selectedTask && <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    {treeOpen && <TaskTreeModal epics={epics} ungroupedTasks={allTasks.filter((task) => !task.epicId)} onClose={() => setTreeOpen(false)} />}
    {taskModalOpen && <TaskFormModal title="ایجاد تسک در بک‌لاگ" submitLabel="ایجاد تسک" assignees={[]} epics={epics} milestones={milestones} parentTasks={allTasks.filter((task) => !task.parentTaskId).map((task) => ({ id: task.id, title: task.title }))} dependencyTasks={allTasks.map((task) => ({ id: task.id, title: task.title, status: task.status as "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" }))} onClose={() => setTaskModalOpen(false)} onSubmit={async (values: FormValues) => { const { note, dependencyTaskIds, ...payload } = values; void note; const response = await fetch(`/api/v1/projects/${projectId}/tasks`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "ایجاد تسک ناموفق بود."); await Promise.all(dependencyTaskIds.map((prerequisiteTaskId) => fetch(`/api/v1/tasks/${result.task.id}/dependencies`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prerequisiteTaskId }) }))); setTaskModalOpen(false); await load(); }} />}
  </div>;
}

function SprintSection({ sprint, search, sprints, canManage, busy, dragged, onDrag, onOpen, onDropTask, onDrop, onMove, onRank }: { sprint: Sprint; search: string; sprints: Sprint[]; canManage: boolean; busy: boolean; dragged: string | null; onDrag: (id: string | null) => void; onOpen: (task: Task) => void; onDropTask: (taskId: string, target: Task) => void; onDrop: (id: string) => void; onMove: (taskId: string, sprintId: string | null) => void; onRank: (taskId: string, rank: number) => void }) {
  return <section onDragOver={(event) => canManage && event.preventDefault()} onDrop={() => dragged && onDrop(dragged)} className={`rounded-xl border p-3 ${sprint.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50/60" : "border-sky-200 bg-sky-50/60"}`}><div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-extrabold">{sprint.status === "ACTIVE" ? "Sprint فعال" : "Sprint آینده"}: {sprint.name}</h3>{sprint.goal && <p className="mt-0.5 text-[11px] text-slate-500">{sprint.goal}</p>}</div><span className="rounded-md bg-white/80 px-2 py-1 text-[11px] text-emerald-800">{sprint.tasks.length.toLocaleString("fa-IR")} تسک · {sprint.storyPoints.toLocaleString("fa-IR")} SP</span></div><TaskList search={search} tasks={sprint.tasks} canManage={canManage} busy={busy} dragged={dragged} sprints={sprints} onDrag={onDrag} onOpen={onOpen} onDropTask={onDropTask} onMove={onMove} onRank={onRank} /></section>;
}

function TaskList({ tasks, search, canManage, busy, dragged, sprints, onDrag, onOpen, onDropTask, onMove, onRank }: { tasks: Task[]; search: string; canManage: boolean; busy: boolean; dragged: string | null; sprints: Sprint[]; onDrag: (id: string | null) => void; onOpen: (task: Task) => void; onDropTask: (taskId: string, target: Task) => void; onMove: (taskId: string, sprintId: string | null) => void; onRank: (taskId: string, rank: number) => void }) {
  const [limit, setLimit] = useState(20);
  const visible = tasks.filter((task) => task.title.toLocaleLowerCase("fa-IR").includes(search.toLocaleLowerCase("fa-IR")) || (task.assignee?.name ?? "").toLocaleLowerCase("fa-IR").includes(search.toLocaleLowerCase("fa-IR")));
  const shown = visible.slice(0, limit);
  if (!visible.length) return <p className="py-5 text-sm text-slate-500">تسکی مطابق فیلتر یا جست‌وجو وجود ندارد.</p>;
  return <div className="space-y-1.5">{shown.map((task) => <article key={task.id} draggable={canManage && !busy} onDragStart={() => onDrag(task.id)} onDragEnd={() => onDrag(null)} onDragOver={(event) => { if (canManage) { event.preventDefault(); event.stopPropagation(); } }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (dragged) onDropTask(dragged, task); }} onClick={() => onOpen(task)} className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border bg-white px-2.5 py-2 transition hover:border-emerald-300 hover:shadow-sm ${dragged === task.id ? "opacity-50" : ""}`}><GripVertical size={14} className="text-slate-400" /><div className="min-w-40 flex-1"><p className="text-sm font-semibold">{task.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{typeLabel[task.type]} · {priorityLabel[task.priority]} · {task.storyPoints ?? "—"} SP · {task.assignee?.name ?? "بدون مسئول"}</p>{task.epic && <span className="mt-1 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Epic: {task.epic.name}</span>}{task.parentTask && <span className="mt-1 mr-1 inline-block rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">زیرتسکِ {task.parentTask.title}</span>}{task._count.subtasks > 0 && <span className="mt-1 mr-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{task._count.subtasks.toLocaleString("fa-IR")} زیرتسک</span>}</div>{canManage && <><input aria-label={`رتبه ${task.title}`} type="number" min="0" max="100000" defaultValue={task.rank} onClick={(event) => event.stopPropagation()} onBlur={(event) => { const rank = Number(event.target.value); if (Number.isFinite(rank) && rank !== task.rank) onRank(task.id, rank); }} className="w-20 rounded-md border px-1.5 py-1 text-[11px]" /><select value={task.sprintId ?? ""} disabled={busy} onClick={(event) => event.stopPropagation()} onChange={(event) => onMove(task.id, event.target.value || null)} className="max-w-32 rounded-md border px-1.5 py-1 text-[11px]"><option value="">Backlog</option>{sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></>}</article>)}{visible.length > shown.length && <button type="button" onClick={() => setLimit((value) => value + 20)} className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700">نمایش ۲۰ تسک دیگر ({(visible.length - shown.length).toLocaleString("fa-IR")})</button>}</div>;
}

function TaskDetailsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={onClose}><div dir="rtl" role="dialog" aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 text-[11px]"><span className="rounded bg-violet-100 px-2 py-1 text-violet-800">{typeLabel[task.type]}</span><span className="rounded bg-amber-100 px-2 py-1 text-amber-800">{priorityLabel[task.priority]}</span></div><h3 className="mt-2 text-lg font-extrabold">{task.title}</h3></div><button type="button" aria-label="بستن" onClick={onClose}><X size={19} /></button></div><div className="mt-5 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">Story Points</span><p className="mt-1 font-bold">{task.storyPoints ?? "بدون برآورد"}</p></div><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">مسئول</span><p className="mt-1 font-bold">{task.assignee?.name ?? "بدون مسئول"}</p></div></div><section className="mt-4"><h4 className="text-sm font-bold">توضیحات</h4><p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-7 text-slate-700">{task.description || "توضیحی ثبت نشده است."}</p></section>{task.acceptanceCriteria && <section className="mt-4"><h4 className="text-sm font-bold">Acceptance Criteria</h4><p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm leading-7 text-emerald-950">{task.acceptanceCriteria}</p></section>}</div></div>;
}

function TaskTreeModal({ epics, ungroupedTasks, onClose }: { epics: Epic[]; ungroupedTasks: Task[]; onClose: () => void }) {
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={onClose}><section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="task-tree-title" className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between gap-4"><div><h3 id="task-tree-title" className="flex items-center gap-2 text-lg font-extrabold"><FolderTree className="text-indigo-600" size={21} />درختچه کارهای پروژه</h3><p className="mt-1 text-xs leading-5 text-slate-500">مسیر هر کار را از Epic تا تسک اصلی و Subtaskهایش دنبال کنید.</p></div><button type="button" aria-label="بستن" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></header><div className="mt-5 space-y-5">{epics.map((epic) => <EpicTree key={epic.id} epic={epic} />)}{ungroupedTasks.filter((task) => !task.parentTaskId).length > 0 && <section><div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">بدون Epic</div><TreeTasks tasks={ungroupedTasks.map((task) => ({ id: task.id, title: task.title, type: task.type, status: task.status, storyPoints: task.storyPoints, parentTaskId: task.parentTaskId, _count: task._count }))} /></section>}</div>{epics.length === 0 && ungroupedTasks.length === 0 && <p className="py-12 text-center text-sm text-slate-500">تسکی برای نمایش وجود ندارد.</p>}</section></div>;
}

function EpicTree({ epic }: { epic: Epic }) {
  return <section><div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-950"><FolderTree size={16} className="shrink-0 text-indigo-600" /><span className="truncate">Epic: {epic.name}</span><span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">{epic._count.tasks.toLocaleString("fa-IR")} تسک</span></div>{epic.description && <p className="mr-2 mt-1 text-xs text-slate-500">{epic.description}</p>}<TreeTasks tasks={epic.tasks} /></section>;
}

function TreeTasks({ tasks }: { tasks: TreeTask[] }) {
  const parents = tasks.filter((task) => !task.parentTaskId);
  const childrenFor = (parentId: string) => tasks.filter((task) => task.parentTaskId === parentId);
  if (!parents.length) return <p className="mr-5 mt-2 text-xs text-slate-500">تسک سطح‌اولی در این بخش ثبت نشده است.</p>;
  return <div className="mr-4 mt-3 border-r-2 border-indigo-100 pr-5">{parents.map((parent) => <div key={parent.id} className="relative pb-3 last:pb-0 before:absolute before:right-[-22px] before:top-5 before:h-px before:w-5 before:bg-indigo-200"><TreeNode task={parent} tone="parent" />{childrenFor(parent.id).length > 0 && <div className="mr-5 mt-2 border-r-2 border-sky-100 pr-5">{childrenFor(parent.id).map((child) => <div key={child.id} className="relative pb-2 last:pb-0 before:absolute before:right-[-22px] before:top-5 before:h-px before:w-5 before:bg-sky-200"><TreeNode task={child} tone="child" /></div>)}</div>}</div>)}</div>;
}

function TreeNode({ task, tone }: { task: TreeTask; tone: "parent" | "child" }) {
  const toneClass = tone === "parent" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-sky-200 bg-sky-50 text-sky-950";
  return <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${toneClass}`}><div><p className="text-sm font-semibold">{task.title}</p><p className="mt-0.5 text-[11px] opacity-75">{tone === "parent" ? "تسک اصلی" : "Subtask"} · {typeLabel[task.type]} · {task.storyPoints ?? "—"} SP</p></div><span className="rounded bg-white/80 px-2 py-1 text-[11px]">{task.status}</span></div>;
}
