"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, LoaderCircle, Plus, UsersRound } from "lucide-react";

type Owner = { id: string; name: string; email: string };
type Company = { id: string; name: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string; members: { user: Owner }[]; _count: { members: number; projects: number } };

export default function CompaniesManager({ initialCompanies, activeUsers }: { initialCompanies: Company[]; activeUsers: Owner[] }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/companies", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ایجاد شرکت ناموفق بود.");
      setCompanies((items) => [{ ...data.company, createdAt: data.company.createdAt }, ...items]);
      setName(""); setOwnerId(""); setOpen(false); setNotice("شرکت جدید ایجاد شد.");
    } catch (err) { setError(err instanceof Error ? err.message : "ایجاد شرکت ناموفق بود."); }
    finally { setSaving(false); }
  }

  async function toggleStatus(company: Company) {
    setBusyId(company.id); setError(""); setNotice("");
    try {
      const status = company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      const response = await fetch(`/api/v1/companies/${company.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تغییر وضعیت ناموفق بود.");
      setCompanies((items) => items.map((item) => item.id === company.id ? { ...data.company, createdAt: data.company.createdAt } : item));
      setNotice(status === "ACTIVE" ? "شرکت فعال شد." : "شرکت تعلیق شد.");
    } catch (err) { setError(err instanceof Error ? err.message : "تغییر وضعیت ناموفق بود."); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div><p className="text-sm font-bold">{companies.length.toLocaleString("fa-IR")} شرکت ثبت‌شده</p><p className="mt-1 text-xs text-[var(--muted)]">هر شرکت فضای مستقل اعضا و پروژه‌های خود را خواهد داشت.</p></div>
      <button type="button" onClick={() => { setOpen((value) => !value); setError(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><Plus size={17} /> شرکت جدید</button>
    </div>

    {open && <form onSubmit={createCompany} className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="block"><span className="mb-2 block text-sm font-bold">نام شرکت</span><input required value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-emerald-500" placeholder="مثلاً شرکت آریا" /></label>
      <label className="block"><span className="mb-2 block text-sm font-bold">مدیر شرکت</span><select required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-emerald-500"><option value="">انتخاب مدیر</option>{activeUsers.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}</select></label>
      <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-60">{saving && <LoaderCircle size={16} className="animate-spin" />}{saving ? "در حال ثبت" : "ایجاد شرکت"}</button>
    </form>}

    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${error ? "border border-rose-100 bg-rose-50 text-rose-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{error || notice}</p>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map((company) => {
      const owner = company.members[0]?.user;
      const active = company.status === "ACTIVE";
      return <article key={company.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={20} /></span><div><h2 className="truncate font-extrabold">{company.name}</h2><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{active ? "فعال" : "تعلیق‌شده"}</span></div></div></div><div className="mt-5 space-y-2 text-sm text-[var(--muted)]"><p>مدیر شرکت: <span className="font-semibold text-slate-700">{owner?.name ?? "تعیین نشده"}</span></p><p className="flex items-center gap-2"><UsersRound size={15} /> {company._count.members.toLocaleString("fa-IR")} عضو · {company._count.projects.toLocaleString("fa-IR")} پروژه</p></div><div className="mt-5 flex flex-wrap gap-2"><Link href={`/companies/${company.id}/members`} className="inline-flex min-h-10 items-center rounded-xl border border-emerald-200 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50">مشاهده اعضا</Link><button type="button" disabled={busyId === company.id} onClick={() => toggleStatus(company)} className={`min-h-10 rounded-xl border px-3 text-xs font-bold disabled:opacity-60 ${active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{busyId === company.id ? "..." : active ? "تعلیق شرکت" : "فعال‌سازی شرکت"}</button></div></article>;
    })}</div>
  </div>;
}
