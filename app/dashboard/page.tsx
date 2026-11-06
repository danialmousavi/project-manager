
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FolderKanban, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/layout/logout-button";

const roleLabels = {
  ADMIN: "مدیر اصلی",
  MANAGER: "مدیر پروژه",
  EMPLOYEE: "کارمند",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              داشبورد مدیریت پروژه
            </p>

            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
              سلام، {user.name}!
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              خوش اومدی. نقش شما: {roleLabels[user.role]}
            </p>
          </div>

          <LogoutButton />
        </header>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            دسترسی سریع
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {user.role === "ADMIN" && (
              <Link
                href="/users"
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Users size={23} />
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  مدیریت کاربران
                </h3>

                <p className="mt-2 text-sm leading-7 text-slate-500">
                  ایجاد حساب، تعیین نقش و مدیریت وضعیت کاربران
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-indigo-600">
                  ورود به بخش کاربران
                  <ArrowLeft
                    size={17}
                    className="transition group-hover:-translate-x-1"
                  />
                </div>
              </Link>
            )}

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6">
              <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <FolderKanban size={23} />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                پروژه‌ها
              </h3>

              <p className="mt-2 text-sm leading-7 text-slate-500">
                این بخش را در مرحله بعد پیاده‌سازی می‌کنیم.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
