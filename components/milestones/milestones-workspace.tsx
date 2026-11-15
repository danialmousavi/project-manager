"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleDotDashed,
  Flag,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import ConfirmDialog from "@/components/ui/confirm-dialog";
import PersianDatePicker from "@/components/ui/persian-date-picker";
import { isoToJalali } from "@/lib/jalali";

type Status = "PLANNED" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
type Milestone = {
  id: string;
  title: string;
  description: string | null;
  targetDate: string;
  completedAt: string | null;
  status: "PLANNED" | "COMPLETED";
  displayStatus: Status;
  totalTasks: number;
  completedTasks: number;
  progress: number;
};
type Response = { canManage: boolean; milestones: Milestone[] };

const statusMeta: Record<Status, { label: string; className: string }> = {
  PLANNED: { label: "برنامه‌ریزی‌شده", className: "bg-slate-100 text-slate-700" },
  DUE_SOON: { label: "نزدیک به موعد", className: "bg-amber-50 text-amber-800" },
  OVERDUE: { label: "با تأخیر", className: "bg-rose-50 text-rose-700" },
  COMPLETED: { label: "انجام‌شده", className: "bg-emerald-50 text-emerald-700" },
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "خطایی رخ داد.";
}

async function requestApi(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "درخواست ناموفق بود.");
  return data;
}

export default function MilestonesWorkspace({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | Milestone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/milestones`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "دریافت مایلستون‌ها ناموفق بود.");
      setData(body);
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = useMemo(() => ({
    total: data?.milestones.length ?? 0,
    completed: data?.milestones.filter((item) => item.displayStatus === "COMPLETED").length ?? 0,
    overdue: data?.milestones.filter((item) => item.displayStatus === "OVERDUE").length ?? 0,
  }), [data]);

  async function removeMilestone() {
    if (!deleteTarget) return;
    setSaving(true);
    setError("");
    try {
      await requestApi(`/api/v1/projects/${projectId}/milestones`, "DELETE", { milestoneId: deleteTarget.id });
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  async function setCompleted(milestone: Milestone) {
    setSaving(true);
    setError("");
    try {
      await requestApi(`/api/v1/projects/${projectId}/milestones`, "PATCH", {
        action: "SET_STATUS",
        milestoneId: milestone.id,
        status: milestone.status === "COMPLETED" ? "PLANNED" : "COMPLETED",
      });
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin text-indigo-600" size={20} />در حال دریافت مایلستون‌ها...</div>;
  }

  return (
    <div dir="rtl" className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-700"><Flag size={15} />نقاط عطف پروژه</p>
          <h1 className="mt-1 text-lg font-extrabold text-[var(--foreground)]">مایلستون‌ها و زمان‌بندی تحویل</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">تاریخ‌های کلیدی را ثبت کنید و پیشرفت تسک‌های متصل به هر نقطه عطف را ببینید.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />به‌روزرسانی</button>
          {data?.canManage && <button type="button" onClick={() => { setModal("create"); setError(""); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700"><Plus size={15} />مایلستون جدید</button>}
        </div>
      </header>

      <section aria-label="خلاصه مایلستون‌ها" className="grid grid-cols-3 gap-2 sm:max-w-xl">
        <Metric label="همه مایلستون‌ها" value={summary.total} />
        <Metric label="انجام‌شده" value={summary.completed} tone="emerald" />
        <Metric label="با تأخیر" value={summary.overdue} tone="rose" />
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}

      {!data?.milestones.length ? (
        <section className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-12 text-center"><Flag className="mx-auto text-indigo-500" size={29} /><h2 className="mt-3 text-sm font-extrabold text-indigo-950">هنوز مایلستونی ثبت نشده است</h2><p className="mx-auto mt-1 max-w-md text-xs leading-6 text-indigo-800">یک خروجی یا تاریخ مهم پروژه، مثل «انتشار نسخه آزمایشی»، را ثبت کنید؛ سپس تسک‌های مرتبط را به آن وصل کنید.</p>{data?.canManage && <button type="button" onClick={() => setModal("create")} className="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">ایجاد اولین مایلستون</button>}</section>
      ) : (
        <div className="space-y-3">
          {data.milestones.map((milestone) => <MilestoneCard key={milestone.id} milestone={milestone} canManage={data.canManage} busy={saving} onEdit={() => setModal(milestone)} onToggle={() => void setCompleted(milestone)} onDelete={() => setDeleteTarget(milestone)} />)}
        </div>
      )}

      {modal && <MilestoneModal projectId={projectId} milestone={modal === "create" ? undefined : modal} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />}
      {deleteTarget && <ConfirmDialog title="حذف مایلستون" description={`مایلستون «${deleteTarget.title}» حذف می‌شود. تسک‌ها باقی می‌مانند و فقط اتصالشان به این مایلستون حذف خواهد شد.`} confirmLabel="حذف مایلستون" busy={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeMilestone()} />}
    </div>
  );
}

function Metric({ label, value, tone = "indigo" }: { label: string; value: number; tone?: "indigo" | "emerald" | "rose" }) {
  const colors = { indigo: "border-indigo-100 bg-indigo-50/50", emerald: "border-emerald-100 bg-emerald-50/50", rose: "border-rose-100 bg-rose-50/50" };
  return <div className={`rounded-xl border px-3 py-2.5 ${colors[tone]}`}><p className="text-[11px] font-semibold text-[var(--muted)]">{label}</p><p className="mt-0.5 text-lg font-extrabold tabular-nums text-[var(--foreground)]">{value.toLocaleString("fa-IR")}</p></div>;
}

function MilestoneCard({ milestone, canManage, busy, onEdit, onToggle, onDelete }: { milestone: Milestone; canManage: boolean; busy: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const meta = statusMeta[milestone.displayStatus];
  return <article className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-l from-indigo-50 to-white px-4 py-3.5 sm:px-5"><div className="flex min-w-0 gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Flag size={18} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-extrabold text-slate-900">{milestone.title}</h2><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${meta.className}`}>{meta.label}</span></div><p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500"><CalendarClock size={13} />موعد: {isoToJalali(milestone.targetDate) || milestone.targetDate}</p></div></div>{canManage && <div className="flex items-center gap-1"><button type="button" disabled={busy} onClick={onEdit} aria-label={`ویرایش ${milestone.title}`} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-indigo-700 disabled:opacity-50"><Pencil size={16} /></button><button type="button" disabled={busy} onClick={onDelete} aria-label={`حذف ${milestone.title}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={16} /></button></div>}</div><div className="space-y-3 p-4 sm:px-5">{milestone.description && <p className="text-xs leading-6 text-slate-600">{milestone.description}</p>}<div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-500">{milestone.completedTasks.toLocaleString("fa-IR")} از {milestone.totalTasks.toLocaleString("fa-IR")} تسک تکمیل شده</span><strong className="text-indigo-700">{milestone.progress.toLocaleString("fa-IR")}٪</strong></div><div className="h-2 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-gradient-to-l from-indigo-600 to-violet-500 transition-all" style={{ width: `${milestone.progress}%` }} /></div>{canManage && <div className="flex justify-end border-t border-slate-100 pt-3"><button type="button" disabled={busy} onClick={onToggle} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${milestone.status === "COMPLETED" ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>{milestone.status === "COMPLETED" ? <CircleDotDashed size={14} /> : <CheckCircle2 size={14} />}{milestone.status === "COMPLETED" ? "بازگرداندن به برنامه" : "علامت‌گذاری به‌عنوان انجام‌شده"}</button></div>}</div></article>;
}

function MilestoneModal({ projectId, milestone, onClose, onSaved }: { projectId: string; milestone?: Milestone; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [targetDate, setTargetDate] = useState<string | null>(milestone?.targetDate ?? null);
  const [status, setStatus] = useState<"PLANNED" | "COMPLETED">(milestone?.status ?? "PLANNED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetDate) { setError("تاریخ هدف را انتخاب کنید."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { title, description: description.trim() || null, targetDate, status };
      if (milestone) await requestApi(`/api/v1/projects/${projectId}/milestones`, "PATCH", { action: "UPDATE_MILESTONE", milestoneId: milestone.id, ...payload });
      else await requestApi(`/api/v1/projects/${projectId}/milestones`, "POST", payload);
      await onSaved();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><form dir="rtl" onSubmit={submit} className="w-full max-w-xl overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="bg-gradient-to-l from-indigo-700 to-violet-700 px-5 py-4 text-white"><p className="text-[11px] font-bold text-indigo-100">نقطه عطف پروژه</p><h2 className="mt-1 text-lg font-extrabold">{milestone ? "ویرایش مایلستون" : "ایجاد مایلستون جدید"}</h2></header><div className="space-y-4 p-5"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">عنوان</span><input required minLength={3} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" placeholder="مثلاً انتشار نسخه آزمایشی" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">توضیحات (اختیاری)</span><textarea rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10" placeholder="خروجی یا معیار این نقطه عطف..." /></label><PersianDatePicker label="تاریخ هدف" value={targetDate} onChange={setTargetDate} disabled={saving} calendarPosition="top-right" portal zIndex={100} /><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">وضعیت</span><select value={status} onChange={(event) => setStatus(event.target.value as "PLANNED" | "COMPLETED")} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"><option value="PLANNED">برنامه‌ریزی‌شده</option><option value="COMPLETED">انجام‌شده</option></select></label>{error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}</div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-50">انصراف</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{saving && <LoaderCircle size={16} className="animate-spin" />}{milestone ? "ذخیره تغییرات" : "ایجاد مایلستون"}</button></footer></form></div>;
}
