import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CircleAlert, ClipboardList, FolderKanban, Layers3, ListTodo, LoaderCircle, MessageSquareText, UsersRound } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

const roles = { ADMIN: "مدیر اصلی", MANAGER: "مدیر پروژه", EMPLOYEE: "کارمند" };
const statuses = { TODO: "در انتظار", IN_PROGRESS: "در حال انجام", IN_REVIEW: "در بازبینی", DONE: "انجام‌شده" };
const projectStatuses = { DRAFT: "پیش‌نویس", PLANNED: "برنامه‌ریزی‌شده", ACTIVE: "فعال", ON_HOLD: "متوقف", COMPLETED: "تکمیل‌شده", CANCELLED: "لغوشده" };
const priorities = { LOW: "کم", MEDIUM: "متوسط", HIGH: "زیاد", URGENT: "فوری" };
const number = (value: number) => value.toLocaleString("fa-IR");
const dateLabel = (date: Date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", day: "numeric", month: "long", year: "numeric" }).format(date);

export default function DashboardPage() {
  return <main id="main-content" className="min-h-dvh px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1440px]"><Suspense fallback={<Loading />}><Content /></Suspense></div></main>;
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getDashboardData(user);
  const isManager = user.role !== "EMPLOYEE";
  const metrics = [
    { label: "پروژه‌های در دسترس", value: data.metrics.projects, icon: FolderKanban },
    { label: user.role === "ADMIN" ? "وظایف باز تیم" : user.role === "MANAGER" ? "وظایف باز قابل پیگیری" : "وظایف باز من", value: data.metrics.openTasks, icon: ListTodo },
    { label: "عقب‌افتاده", value: data.metrics.overdueTasks, icon: CircleAlert },
    { label: "سررسید تا ۷ روز", value: data.metrics.dueSoonTasks, icon: CalendarClock },
    { label: "در بازبینی", value: data.metrics.reviewTasks, icon: ClipboardList },
  ];

  return <>
    <header className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><Layers3 aria-hidden="true" size={16} /> فضای کاری شما</p><h1 className="mt-1 text-xl font-extrabold sm:text-2xl">سلام، {user.name}</h1><p className="mt-1 text-sm text-[var(--muted)]">نمای امروز · {roles[user.role]} · {dateLabel(data.today)}</p></div>
      </div>
    </header>

    <div className="mt-5"><h2 className="text-lg font-bold">نمای کارها</h2><p className="text-sm text-[var(--muted)]">آنچه امروز برای پیگیری اهمیت دارد</p></div>
    <section aria-label="شاخص‌های کاری" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {metrics.map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${label === "عقب‌افتاده" && value ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}><Icon aria-hidden="true" size={19} /></div><div className="min-w-0"><p className="text-xs leading-5 text-[var(--muted)]">{label}</p><p className="text-xl font-extrabold tabular-nums">{number(value)}</p></div></div>)}
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
      <section aria-labelledby="my-tasks-title" className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Heading id="my-tasks-title" title="کارهای من" description="وظایف باز واگذارشده به شما" />
        {data.myTasks.length === 0 ? <Empty text="وظیفهٔ بازی به شما واگذار نشده است." /> : <ul className="mt-3 divide-y divide-[var(--border)]">{data.myTasks.map((task) => {
          const overdue = Boolean(task.dueDate && task.dueDate < data.today);
          const today = Boolean(task.dueDate && task.dueDate >= data.today && task.dueDate < data.tomorrow);
          return <li key={task.id} className="py-2.5 first:pt-0 last:pb-0"><Link href={`/projects/${task.projectId}/tasks#task-${task.id}`} className="group flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-1 hover:bg-emerald-50"><span className="min-w-0"><span className="block font-semibold group-hover:text-emerald-700">{task.title}</span><span className="block text-xs text-[var(--muted)]">{task.project.name} · {statuses[task.status]} · اولویت {priorities[task.priority]}</span></span><span className={`text-xs font-semibold ${overdue ? "text-rose-700" : today ? "text-amber-800" : "text-[var(--muted)]"}`}>{overdue ? "عقب‌افتاده · " : today ? "امروز · " : ""}{task.dueDate ? dateLabel(task.dueDate) : "بدون مهلت"}</span></Link></li>;
        })}</ul>}
      </section>

      <section aria-labelledby="projects-title" className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Heading id="projects-title" title="وضعیت پروژه‌ها" description="پیشرفت واقعی و مهلت‌های ثبت‌شده" />
        {data.projects.length === 0 ? <Empty text="هنوز پروژه‌ای در دسترس شما نیست." /> : <ul className="mt-3 space-y-2">{data.projects.map((project) => <li key={project.id}><Link href={`/projects/${project.id}`} className="block rounded-xl border border-[var(--border)] px-3 py-2.5 hover:border-[var(--primary-border)] hover:bg-emerald-50/50"><div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 font-semibold">{project.name}</span><span className="text-xs text-[var(--muted)]">{projectStatuses[project.status]}</span></div><div className="mt-2 flex items-center gap-3"><div role="progressbar" aria-label={`پیشرفت ${project.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress} className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${project.progress}%` }} /></div><span className="text-xs font-bold tabular-nums">{number(project.progress)}٪</span></div><p className="mt-1.5 text-xs text-[var(--muted)]">{project.overdue ? `${number(project.overdue)} کار عقب‌افتاده` : "بدون کار عقب‌افتاده"}{project.dueDate ? ` · مهلت پروژه: ${dateLabel(project.dueDate)}` : ""}</p></Link></li>)}</ul>}
      </section>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <section aria-labelledby="sprints-title" className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"><Heading id="sprints-title" title="اسپرینت‌های فعال" description="اسپرینت‌ها و تاریخ پایانشان" />{data.sprints.length === 0 ? <Empty text="اسپرینت فعالی ثبت نشده است." /> : <ul className="mt-3 divide-y divide-[var(--border)]">{data.sprints.map((sprint) => <li key={sprint.id}><Link href={`/projects/${sprint.projectId}/sprints`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2 hover:text-emerald-700"><span className="min-w-0"><span className="block font-semibold">{sprint.name}</span><span className="block text-xs text-[var(--muted)]">{sprint.project.name}</span></span><span className="text-xs text-[var(--muted)]">{sprint.endDate ? dateLabel(sprint.endDate) : "بدون تاریخ پایان"}</span></Link></li>)}</ul>}</section>
      {isManager && <section aria-labelledby="workload-title" className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"><Heading id="workload-title" title="توزیع کار تیم" description="وظایف باز پروژه‌های تحت مدیریت" />{data.workload.length === 0 ? <Empty text="هنوز وظیفهٔ بازی در تیم ثبت نشده است." /> : <ul className="mt-3 divide-y divide-[var(--border)]">{data.workload.map((item) => <li key={item.id ?? "unassigned"} className="flex min-h-11 items-center justify-between gap-2 py-2 text-sm"><span className="flex items-center gap-2"><UsersRound aria-hidden="true" size={16} className="text-emerald-700" />{item.name}</span><span className="text-xs text-[var(--muted)]">{number(item.count)} باز{item.overdue ? ` · ${number(item.overdue)} عقب‌افتاده` : ""}</span></li>)}</ul>}</section>}
      <section aria-labelledby="activity-title" className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"><Heading id="activity-title" title="گفتگوهای اخیر" description="کامنت‌های وظایفی که به آن‌ها دسترسی دارید" />{data.comments.length === 0 ? <Empty text="گفتگوی تازه‌ای وجود ندارد." /> : <ul className="mt-3 divide-y divide-[var(--border)]">{data.comments.map((comment) => <li key={comment.id} className="py-2 text-sm"><Link href={`/projects/${comment.task.projectId}/tasks#task-${comment.task.id}`} className="block rounded-lg p-1 hover:bg-emerald-50"><span className="flex items-center gap-2 font-semibold"><MessageSquareText aria-hidden="true" size={16} className="text-emerald-700" />{comment.task.title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{comment.author.name} · {dateLabel(comment.createdAt)}</span><span className="mt-1 block line-clamp-2 text-xs">{comment.content}</span></Link></li>)}</ul>}</section>
    </div>

    <section aria-label="میان‌برهای کاری" className="mt-4 flex flex-wrap gap-2 pb-4"><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700" href="/projects"><FolderKanban aria-hidden="true" size={16} /> مدیریت پروژه‌ها</Link>{user.role === "ADMIN" && <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold hover:bg-emerald-50" href="/users"><UsersRound aria-hidden="true" size={16} /> مدیریت کاربران</Link>}</section>
  </>;
}

function Heading({ id, title, description }: { id: string; title: string; description: string }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-3"><h2 id={id} className="text-base font-bold">{title}</h2><p className="text-xs text-[var(--muted)]">{description}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="flex min-h-24 items-center gap-2 py-4 text-sm text-[var(--muted)]"><ClipboardList aria-hidden="true" size={19} />{text}</div>;
}

function Loading() {
  return <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-[var(--muted)]"><LoaderCircle aria-hidden="true" size={22} className="animate-spin" />در حال آماده‌سازی داشبورد...</div>;
}
