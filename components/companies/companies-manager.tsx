"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, FolderKanban, LoaderCircle, Plus, Search, UsersRound } from "lucide-react";

type Owner = { id: string; name: string; email: string };
type Company = { id: string; name: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string; projects: { id: string; name: string }[]; members: { user: Owner }[]; _count: { members: number; projects: number } };

export default function CompaniesManager({ initialCompanies, activeUsers }: { initialCompanies: Company[]; activeUsers: Owner[] }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const filteredCompanies = companies.filter((company) => `${company.name} ${company.members.map((member) => member.user.name).join(" ")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/v1/companies", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ownerId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ایجاد شرکت ناموفق بود.");
      setCompanies((items) => [{ ...data.company, createdAt: data.company.createdAt, projects: [] }, ...items]);
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
      setCompanies((items) => items.map((item) => item.id === company.id ? { ...item, ...data.company, createdAt: data.company.createdAt } : item));
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

    <div className="grid gap-3 sm:grid-cols-3">
      {[['کل شرکت‌ها', companies.length], ['شرکت‌های فعال', companies.filter((company) => company.status === 'ACTIVE').length], ['شرکت‌های تعلیق‌شده', companies.filter((company) => company.status === 'SUSPENDED').length]].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{Number(count).toLocaleString('fa-IR')}</p></div>)}
    </div>
    <label className="flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400"><Search size={18} /><span className="sr-only">جستجوی شرکت یا مالک</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجوی شرکت یا مالک..." className="min-h-11 w-full bg-transparent text-sm text-slate-800 outline-none" /></label>
    {filteredCompanies.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">شرکتی برای نمایش پیدا نشد.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredCompanies.map((company) => {
      const owner = company.members[0]?.user;
      const active = company.status === "ACTIVE";
      return <article key={company.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={20} /></span><div><h2 className="truncate font-extrabold">{company.name}</h2><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{active ? "فعال" : "تعلیق‌شده"}</span></div></div></div><div className="mt-5 space-y-2 text-sm text-[var(--muted)]"><p>مالک شرکت: <span className="font-semibold text-slate-700">{owner?.name ?? "تعیین نشده"}</span></p><p className="text-xs">تاریخ ایجاد: {new Date(company.createdAt).toLocaleDateString("fa-IR")}</p><div className="grid grid-cols-2 gap-2 pt-2"><div className="rounded-xl bg-slate-50 p-3"><UsersRound size={16} className="text-emerald-600" /><p className="mt-1 font-bold text-slate-800">{company._count.members.toLocaleString("fa-IR")} عضو</p></div><div className="rounded-xl bg-slate-50 p-3"><FolderKanban size={16} className="text-emerald-600" /><p className="mt-1 font-bold text-slate-800">{company._count.projects.toLocaleString("fa-IR")} پروژه</p></div></div></div><div className="mt-5 flex flex-wrap gap-2">{company.projects.length === 1 ? <Link href={`/projects/${company.projects[0].id}`} className="inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">مشاهده پروژه</Link> : company.projects.length > 1 ? <details className="relative"><summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">انتخاب پروژه</summary><div className="absolute right-0 z-20 mt-1 max-h-64 min-w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{company.projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700">{project.name}</Link>)}</div></details> : <Link href={`/companies/${company.id}/projects`} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">پروژه‌ها</Link>}<Link href={`/companies/${company.id}/members`} className="inline-flex min-h-10 items-center rounded-xl border border-emerald-200 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50">مشاهده اعضا</Link><button type="button" disabled={busyId === company.id} onClick={() => toggleStatus(company)} className={`min-h-10 rounded-xl border px-3 text-xs font-bold disabled:opacity-60 ${active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{busyId === company.id ? "..." : active ? "تعلیق شرکت" : "فعال‌سازی شرکت"}</button></div></article>;
    })}</div>
  </div>;
}
