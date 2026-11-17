import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  return (
    <main id="main-content" className="min-h-dvh bg-[var(--background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Bell size={21} /></span>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--foreground)]">همهٔ اعلان‌ها</h1>
              <p className="mt-1 text-xs text-[var(--muted)]">آخرین {notifications.length.toLocaleString("fa-IR")} اعلان شما</p>
            </div>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50">بازگشت به داشبورد</Link>
        </header>

        {notifications.length === 0 ? (
          <section className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white px-5 py-14 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={30} />
            <h2 className="mt-3 text-sm font-extrabold">اعلانی ندارید</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">رویدادهای مهم پروژه‌ها و وظایف شما در این بخش نمایش داده می‌شوند.</p>
          </section>
        ) : (
          <ul className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            {notifications.map((notification) => (
              <li key={notification.id} className={`border-b border-slate-100 last:border-b-0 ${notification.readAt ? "bg-white" : "bg-emerald-50/45"}`}>
                <Link href={notification.href} className="block px-5 py-4 transition hover:bg-emerald-50">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-slate-300" : "bg-emerald-600"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${notification.readAt ? "font-semibold text-slate-700" : "font-extrabold text-emerald-950"}`}>{notification.title}</p>
                      {notification.body && <p className="mt-1 text-xs leading-6 text-slate-600">{notification.body}</p>}
                      <time dateTime={notification.createdAt.toISOString()} className="mt-2 block text-[11px] text-slate-400">{dateFormatter.format(notification.createdAt)}</time>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
