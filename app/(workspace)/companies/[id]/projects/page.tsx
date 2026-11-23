import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Building2, FolderKanban, UsersRound } from "lucide-react";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateProjectProgress } from "@/lib/project-progress";
import { isoToJalali } from "@/lib/jalali";

const labels = { DRAFT: "پیش‌نویس", PLANNED: "برنامه‌ریزی‌شده", ACTIVE: "در حال اجرا", ON_HOLD: "متوقف‌شده", COMPLETED: "تکمیل‌شده", CANCELLED: "لغوشده" } as const;

export default async function CompanyProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") notFound();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const company = await prisma.company.findUnique({ where: { id }, select: { name: true, status: true, projects: { where: { archivedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, description: true, status: true, dueDate: true, members: { where: { role: "MANAGER" }, select: { user: { select: { name: true } } } }, _count: { select: { members: true, tasks: { where: { deletedAt: null } } } } } } } });
  if (!company) notFound();
  const groups = await prisma.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: company.projects.map((project) => project.id) }, deletedAt: null }, _count: { _all: true } });
  const activeCount = company.projects.filter((project) => project.status === "ACTIVE").length;
  const completedCount = company.projects.filter((project) => project.status === "COMPLETED").length;
  return <main id="main-content" dir="rtl" className="min-h-dvh bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <Link href="/companies" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-900"><ArrowRight size={17} />بازگشت به شرکت‌ها</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Building2 size={22} /></span><div><p className="text-xs font-bold text-emerald-700">پروژه‌های شرکت</p><h1 className="mt-1 text-xl font-extrabold text-slate-950">{company.name}</h1><p className="mt-2 text-sm text-slate-500">مرور وضعیت پروژه‌ها و دسترسی به جزئیات هر پروژه</p></div></div><Link href={`/companies/${id}/members`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50"><UsersRound size={16} />اعضای شرکت</Link></header>
    <section aria-label="خلاصه پروژه‌ها" className="grid gap-3 sm:grid-cols-3">{[["کل پروژه‌ها", company.projects.length], ["در حال اجرا", activeCount], ["تکمیل‌شده", completedCount]].map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{Number(count).toLocaleString("fa-IR")}</p></div>)}</section>
    {company.projects.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center"><FolderKanban className="mx-auto text-emerald-500" size={30} /><h2 className="mt-3 font-bold text-slate-800">هنوز پروژه‌ای ثبت نشده است</h2><p className="mt-2 text-sm text-slate-500">پروژه‌های این شرکت در این بخش نمایش داده می‌شوند.</p></div> : <div className="grid gap-4 md:grid-cols-2">{company.projects.map((project) => { const progress = calculateProjectProgress(groups.filter((group) => group.projectId === project.id).map((group) => ({ status: group.status, count: group._count._all }))); return <article key={project.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-extrabold text-slate-900">{project.name}</h2><p className="mt-1 text-xs text-slate-500">مدیر: {project.members.map((member) => member.user.name).join("، ") || "تعیین نشده"}</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">{labels[project.status]}</span></div><p className="mt-4 min-h-10 line-clamp-2 text-sm leading-6 text-slate-500">{project.description || "توضیحی برای پروژه ثبت نشده است."}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500"><span>{project._count.members.toLocaleString("fa-IR")} عضو</span><span>{project._count.tasks.toLocaleString("fa-IR")} وظیفه</span><span>موعد: {project.dueDate ? isoToJalali(project.dueDate.toISOString()) : "تعیین نشده"}</span></div><div className="mt-4"><div className="flex justify-between text-xs"><span className="text-slate-500">پیشرفت وظایف</span><strong className="text-emerald-700">{progress.toLocaleString("fa-IR")}٪</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div></div><Link href={`/projects/${project.id}`} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50">مشاهده پروژه</Link></article>; })}</div>}
  </div></main>;
}
