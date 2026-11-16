"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, X } from "lucide-react";

import type { Sprint } from "./types";

type SprintTask = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  storyPoints?: number | null;
};

type Props = {
  sprint: Sprint;
  tasks: SprintTask[];
  futureSprints: Sprint[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (destinationSprintId: string | null) => void;
};

export default function SprintEndModal({
  sprint,
  tasks,
  futureSprints,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const [destination, setDestination] = useState<"BACKLOG" | string>("BACKLOG");
  const summary = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "DONE");
    const incomplete = tasks.filter((task) => task.status !== "DONE");
    const points = (items: SprintTask[]) =>
      items.reduce((total, task) => total + (task.storyPoints ?? 0), 0);

    return {
      completedCount: completed.length,
      incompleteCount: incomplete.length,
      completedPoints: points(completed),
      incompletePoints: points(incomplete),
    };
  }, [tasks]);

  const plannedTasks = sprint.startSnapshot?.plannedTaskCount ?? tasks.length;
  const plannedPoints = sprint.startSnapshot?.plannedStoryPoints ?? summary.completedPoints + summary.incompletePoints;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
      <section
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sprint-end-title"
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50 px-5 py-4 sm:px-6">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h3 id="sprint-end-title" className="text-base font-extrabold text-slate-900">پایان اسپرینت «{sprint.name}»</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">نتیجه اسپرینت ثبت می‌شود و بعداً قابل تغییر نیست.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="بستن" className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-50"><X size={19} /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="تسک برنامه‌ریزی‌شده" value={plannedTasks} />
            <Metric label="انجام‌شده" value={summary.completedCount} tone="green" />
            <Metric label="ناتمام" value={summary.incompleteCount} tone="amber" />
            <Metric label="امتیاز برنامه‌ریزی‌شده" value={plannedPoints} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ArrowLeft size={16} className="text-emerald-600" /> تکلیف تسک‌های ناتمام</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">وضعیت تسک‌ها تغییر نمی‌کند؛ فقط از اسپرینت فعال خارج یا به اسپرینت آینده منتقل می‌شوند.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-xl border p-3 ${destination === "BACKLOG" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <input className="sr-only" type="radio" name="unfinished-destination" checked={destination === "BACKLOG"} onChange={() => setDestination("BACKLOG")} disabled={busy} />
                <span className="block text-sm font-bold">بازگشت به Backlog</span>
                <span className="mt-1 block text-xs text-slate-500">{summary.incompleteCount.toLocaleString("fa-IR")} تسک ناتمام خارج از اسپرینت می‌ماند.</span>
              </label>
              <label className={`cursor-pointer rounded-xl border p-3 ${destination !== "BACKLOG" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <span className="block text-sm font-bold">انتقال به اسپرینت آینده</span>
                <select value={destination === "BACKLOG" ? "" : destination} onChange={(event) => setDestination(event.target.value || "BACKLOG")} disabled={busy || futureSprints.length === 0} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500">
                  <option value="">{futureSprints.length ? "اسپرینت مقصد را انتخاب کنید" : "اسپرینت آینده‌ای وجود ندارد"}</option>
                  {futureSprints.map((future) => <option key={future.id} value={future.id}>{future.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <span>انجام‌شده: {summary.completedPoints.toLocaleString("fa-IR")} SP</span>
            <span>ناتمام: {summary.incompletePoints.toLocaleString("fa-IR")} SP</span>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">انصراف</button>
          <button type="button" onClick={() => onConfirm(destination === "BACKLOG" ? null : destination)} disabled={busy || (destination !== "BACKLOG" && !destination)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
            <CheckCircle2 size={17} />
            {busy ? "در حال ثبت..." : "ثبت پایان اسپرینت"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "amber" }) {
  const colors = {
    slate: "border-slate-200 bg-white text-slate-900",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
  };
  return <div className={`rounded-xl border p-3 ${colors[tone]}`}><p className="text-[11px] leading-4 text-slate-500">{label}</p><p className="mt-1 text-lg font-extrabold">{value.toLocaleString("fa-IR")}</p></div>;
}
