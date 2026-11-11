"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CirclePause,
  Cloud,
  History,
  LoaderCircle,
  Play,
  Save,
  TimerReset,
} from "lucide-react";

type WorkMode = "ONSITE" | "REMOTE";
type Status = "RUNNING" | "PAUSED" | "SAVED";

type Segment = {
  id: string;
  startedAt: string;
  stoppedAt: string | null;
};

type Entry = {
  id: string;
  workMode: WorkMode;
  status: Status;
  totalSeconds: number;
  startedAt: string;
  savedAt: string | null;
  segments: Segment[];
};

type OvertimeData = { draft: Entry | null; history: Entry[] };

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest]
    .map((part) => part.toLocaleString("fa-IR", { minimumIntegerDigits: 2, useGrouping: false }))
    .join(":");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function currentPersianMonth(value: string) {
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
  });
  const signature = (date: Date) => formatter.formatToParts(date)
    .filter((part) => part.type === "year" || part.type === "month")
    .map((part) => part.value)
    .join("-");
  return signature(new Date(value)) === signature(new Date());
}

function workModeLabel(mode: WorkMode) {
  return mode === "REMOTE" ? "ریموت" : "داخل شرکت";
}

export default function OvertimeManager() {
  const [data, setData] = useState<OvertimeData | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>("ONSITE");
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/overtime", { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "دریافت اطلاعات اضافه‌کار ناموفق بود");
    setData(body);
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "دریافت اطلاعات ناموفق بود"));
  }, [load]);

  const draft = data?.draft ?? null;
  const activeSegment = draft?.status === "RUNNING"
    ? draft.segments.find((segment) => segment.stoppedAt === null)
    : null;
  const displayedSeconds = draft
    ? draft.totalSeconds + (activeSegment ? Math.max(0, Math.floor(((now ?? new Date(activeSegment.startedAt).getTime()) - new Date(activeSegment.startedAt).getTime()) / 1000)) : 0)
    : 0;

  useEffect(() => {
    if (!activeSegment) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeSegment]);

  const monthSeconds = useMemo(() => {
    if (!data) return 0;
    const saved = data.history
      .filter((entry) => entry.savedAt && currentPersianMonth(entry.savedAt))
      .reduce((total, entry) => total + entry.totalSeconds, 0);
    return saved + (draft ? displayedSeconds : 0);
  }, [data, draft, displayedSeconds]);

  async function action(nextAction: "START" | "PAUSE" | "RESUME" | "SAVE") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/overtime", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextAction === "START" ? { action: nextAction, workMode } : { action: nextAction }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "عملیات انجام نشد");
      await load();
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "عملیات انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <div role="status" className="flex min-h-72 items-center justify-center gap-3 rounded-3xl border border-white/80 bg-white text-sm text-[var(--muted)] shadow-sm"><LoaderCircle aria-hidden="true" size={22} className="animate-spin" />در حال دریافت تایمر...</div>;
  }

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-700 via-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-7">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-emerald-100"><TimerReset size={21} aria-hidden="true" /><span className="text-sm font-bold">تایمر اضافه‌کار</span></div>{draft && <span className={`rounded-full px-3 py-1 text-xs font-bold ${draft.status === "RUNNING" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"}`}>{draft.status === "RUNNING" ? "در حال ثبت" : "متوقف‌شده"}</span>}</div>
      <p aria-live="polite" className="mt-8 font-mono text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">{formatDuration(displayedSeconds)}</p>
      <p className="mt-3 text-sm text-emerald-50">{draft ? `${workModeLabel(draft.workMode)} · شروع ${formatDate(draft.startedAt)}` : "نوع حضور را انتخاب کنید و تایمر را شروع کنید."}</p>

      {!draft && <fieldset className="mt-6 grid grid-cols-2 gap-2" disabled={busy}><legend className="sr-only">نوع حضور</legend>{(["ONSITE", "REMOTE"] as const).map((mode) => { const Icon = mode === "ONSITE" ? Building2 : Cloud; const selected = workMode === mode; return <label key={mode} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${selected ? "border-white bg-white text-emerald-800" : "border-white/30 bg-white/10 text-white hover:bg-white/20"}`}><input className="sr-only" type="radio" name="work-mode" value={mode} checked={selected} onChange={() => setWorkMode(mode)} /><Icon size={17} aria-hidden="true" />{workModeLabel(mode)}</label>; })}</fieldset>}

      <div className="mt-6 flex flex-wrap gap-2">{!draft && <ActionButton busy={busy} onClick={() => action("START")} icon={Play}>شروع اضافه‌کار</ActionButton>}{draft?.status === "RUNNING" && <ActionButton busy={busy} onClick={() => action("PAUSE")} icon={CirclePause}>توقف موقت</ActionButton>}{draft?.status === "PAUSED" && <><ActionButton busy={busy} onClick={() => action("RESUME")} icon={Play}>ادامه</ActionButton><ActionButton busy={busy} onClick={() => action("SAVE")} icon={Save} secondary>ذخیره نهایی</ActionButton></>}</div>
      {draft?.status === "PAUSED" && <p className="mt-4 text-xs leading-6 text-emerald-50">تایمر فعلاً ذخیره نشده است. می‌توانید آن را ادامه دهید یا پس از اطمینان، ذخیره نهایی کنید.</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
    </section>

    <section className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4"><div><p className="text-sm font-bold text-emerald-700">جمع ماه شمسی جاری</p><p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">{formatDuration(monthSeconds)}</p></div><span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{data?.history.filter((entry) => entry.savedAt && currentPersianMonth(entry.savedAt)).length.toLocaleString("fa-IR")} ثبت نهایی</span></div><div className="mt-5"><div className="flex items-center gap-2"><History size={18} className="text-emerald-700" aria-hidden="true" /><h2 className="text-base font-extrabold">تاریخچهٔ اخیر</h2></div>{data?.history.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">هنوز اضافه‌کار ذخیره‌شده‌ای ندارید.</p> : <ul className="mt-3 max-h-80 divide-y divide-[var(--border)] overflow-y-auto">{data?.history.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 py-3 first:pt-0"><div className="min-w-0"><p className="truncate text-sm font-bold">{workModeLabel(entry.workMode)} · {formatDate(entry.savedAt ?? entry.startedAt)}</p><p className="mt-1 text-xs text-[var(--muted)]">{entry.segments.length.toLocaleString("fa-IR")} بازهٔ کاری</p></div><strong className="shrink-0 font-mono text-sm tabular-nums text-emerald-700">{formatDuration(entry.totalSeconds)}</strong></li>)}</ul>}</div></section>
  </div>;
}

function ActionButton({ children, busy, onClick, icon: Icon, secondary = false }: { children: React.ReactNode; busy: boolean; onClick: () => void; icon: typeof Play; secondary?: boolean }) {
  return <button type="button" disabled={busy} onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-65 ${secondary ? "bg-white/15 text-white ring-1 ring-inset ring-white/50 hover:bg-white/25" : "bg-white text-emerald-800 hover:bg-emerald-50"}`}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Icon size={17} aria-hidden="true" />}{children}</button>;
}
