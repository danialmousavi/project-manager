
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  FolderKanban,
  Layers3,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/layout/logout-button";

const roleLabels = {
  ADMIN: "مدیر اصلی",
  MANAGER: "مدیر پروژه",
  EMPLOYEE: "کارمند",
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#f7fcf9] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<DashboardLoading />}>
          <DashboardContent />
        </Suspense>
      </div>
    </main>
  );
}

async function DashboardContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <Layers3 size={15} />
            سامانه مدیریت پروژه
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            سلام، {user.name}!
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            خوش اومدی. از اینجا می‌تونی پروژه‌ها و فعالیت‌های
            خودت رو مدیریت کنی.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <ShieldCheck size={16} className="text-emerald-600" />
            نقش شما: {roleLabels[user.role]}
          </div>
        </div>

        <LogoutButton />
      </header>

      {/* Quick access */}
      <section className="mt-8">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">
            دسترسی سریع
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            برای شروع، یکی از بخش‌های زیر رو انتخاب کن.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {user.role === "ADMIN" && (
            <Link
              href="/users"
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Users size={23} />
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                مدیریت کاربران
              </h3>

              <p className="mt-2 text-sm leading-7 text-slate-500">
                ایجاد حساب کاربری، ثبت کد ملی و شماره تماس،
                تعیین نقش و مدیریت وضعیت کاربران.
              </p>

              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-600">
                ورود به مدیریت کاربران
                <ArrowLeft
                  size={17}
                  className="transition group-hover:-translate-x-1"
                />
              </div>
            </Link>
          )}

          <Link
            href="/projects"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <FolderKanban size={23} />
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900">
              پروژه‌ها
            </h3>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              مشاهده پروژه‌ها، اعضای هر پروژه و میزان
              پیشرفت فعالیت‌ها.
            </p>

            <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-600">
              مشاهده پروژه‌ها
              <ArrowLeft
                size={17}
                className="transition group-hover:-translate-x-1"
              />
            </div>
          </Link>
        </div>
      </section>

      {/* Information */}
      <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              حساب کاربری شما فعال است
            </h3>

            <p className="mt-2 text-sm leading-7 text-slate-600">
              شما با نقش {roleLabels[user.role]} وارد سامانه
              شده‌اید. بخش‌هایی که می‌بینید متناسب با
              سطح دسترسی شما نمایش داده می‌شوند.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function DashboardLoading() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4">
      <LoaderCircle
        size={32}
        className="animate-spin text-emerald-600"
      />

      <p className="text-sm text-slate-500">
        در حال آماده‌سازی داشبورد...
      </p>
    </div>
  );
}
