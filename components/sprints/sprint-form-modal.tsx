"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

import PersianDatePicker from "@/components/ui/persian-date-picker";
import type { Sprint } from "./types";

const inputClass =
  "w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

type SprintValues = {
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
};

export default function SprintFormModal({
  sprint,
  busy,
  onClose,
  onSubmit,
}: {
  sprint: Sprint | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: SprintValues) => void;
}) {
  const [name, setName] = useState(sprint?.name ?? "");
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [startDate, setStartDate] = useState(sprint?.startDate ?? null);
  const [endDate, setEndDate] = useState(sprint?.endDate ?? null);
  const [formError, setFormError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 3) return setFormError("نام اسپرینت باید حداقل ۳ کاراکتر باشد.");
    if (!startDate || !endDate) return setFormError("تاریخ شروع و پایان اسپرینت الزامی است.");
    if (startDate > endDate) return setFormError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.");
    onSubmit({ name: trimmedName, goal: goal.trim() || null, startDate, endDate });
  }

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4"><div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="sprint-form-title" className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><h3 id="sprint-form-title" className="text-lg font-extrabold">{sprint ? "ویرایش اسپرینت" : "ایجاد اسپرینت آینده"}</h3><p className="mt-1 text-sm text-slate-500">هدف و بازه زمانی اسپرینت را مشخص کنید.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="بستن"><X size={20} /></button></div><form onSubmit={submit} className="mt-6 space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold">نام اسپرینت</span><input className={inputClass} value={name} maxLength={150} disabled={busy} onChange={(event) => setName(event.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-semibold">هدف اسپرینت (اختیاری)</span><textarea className={inputClass} rows={3} maxLength={2000} value={goal} disabled={busy} onChange={(event) => setGoal(event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><PersianDatePicker label="تاریخ شروع" value={startDate} onChange={setStartDate} disabled={busy} /><PersianDatePicker label="تاریخ پایان" value={endDate} onChange={setEndDate} disabled={busy} /></div>{formError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{formError}</p>}<div className="flex justify-end gap-3 border-t border-emerald-100 pt-5"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-emerald-200 px-5 py-3 text-sm">انصراف</button><button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "در حال ذخیره..." : "ذخیره"}</button></div></form></div></div>;
}

export type { SprintValues };
