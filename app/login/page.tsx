
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  Layers3,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/auth/login-form";

const features = [
  {
    icon: FolderKanban,
    title: "مدیریت پروژه‌ها",
    description: "همه پروژه‌ها در یک فضای کاری",
  },
  {
    icon: ListTodo,
    title: "مدیریت وظایف",
    description: "تقسیم کار و پیگیری فعالیت‌ها",
  },
  {
    icon: CalendarDays,
    title: "زمان‌بندی شمسی",
    description: "اسپرینت‌ها و تقویم تعاملی",
  },
  {
    icon: Activity,
    title: "پیشرفت خودکار",
    description: "براساس وضعیت واقعی وظایف",
  },
];

export default function LoginPage() {
  return (
    <main
      id="main-content"
      dir="rtl"
      className="min-h-dvh lg:h-dvh lg:overflow-hidden"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <Suspense fallback={<LoginPageLoading />}>
        <LoginPageContent />
      </Suspense>
    </main>
  );
}

async function LoginPageContent() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-dvh lg:h-full lg:min-h-0 lg:grid-cols-2">
      {/* RIGHT: Login form */}
      <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="بازگشت به صفحه اصلی"
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/15">
              <Layers3 size={23} />
            </div>

            <div>
              <h1 className="text-lg font-extrabold">
                مدیر پروژه
              </h1>

              <p
                className="mt-1 text-xs"
                style={{ color: "var(--muted)" }}
              >
                سامانه مدیریت پروژه و وظایف
              </p>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            <ArrowRight size={16} />
            <span className="hidden sm:inline">
              صفحه اصلی
            </span>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-6 lg:py-3">
          <div className="w-full max-w-[440px]">
            <div className="mb-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                <LockKeyhole size={15} />
                ورود امن به سامانه
              </span>

              <h2 className="mt-4 text-3xl font-extrabold leading-relaxed">
                خوش اومدی!
                <span className="text-emerald-600">
                  {" "}آماده شروعی؟
                </span>
              </h2>

              <p
                className="mt-2 text-sm leading-7"
                style={{ color: "var(--muted)" }}
              >
                برای ورود به فضای کاری، اطلاعات
                حساب کاربری خودت رو وارد کن.
              </p>
            </div>

            <div className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-7">
              <div className="mb-5 flex items-center gap-3 border-b border-emerald-100 pb-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck size={21} />
                </div>

                <div>
                  <h3 className="text-base font-extrabold">
                    ورود به حساب کاربری
                  </h3>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    اطلاعات ورود خودت رو وارد کن
                  </p>
                </div>
              </div>

              <LoginForm />
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <ShieldCheck
                size={16}
                className="text-emerald-600"
              />

              <p
                className="text-center text-xs leading-6"
                style={{ color: "var(--muted)" }}
              >
                دسترسی براساس نقش و مجوزهای کاربری
                مدیریت می‌شود.
              </p>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-emerald-100 pt-4">
          <p
            className="text-xs"
            style={{ color: "var(--muted)" }}
          >
            سامانه یکپارچه مدیریت پروژه
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-600"
          >
            بازگشت به صفحه اصلی
            <ArrowLeft size={15} />
          </Link>
        </footer>
      </section>

      {/* LEFT: Introduction panel */}
      <aside className="relative hidden h-full min-h-0 flex-col justify-between overflow-hidden bg-emerald-600 px-8 py-6 text-white lg:flex xl:px-12">
        {/* Decorative background */}
        <div className="pointer-events-none absolute -left-28 -top-28 size-[360px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-0 size-[360px] rounded-full bg-emerald-300/20 blur-3xl" />

        {/* Panel header */}
        <div className="relative flex shrink-0 items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl border border-white/20 bg-white/10">
            <Sparkles size={18} />
          </div>

          <span className="text-xs font-semibold text-emerald-50">
            یک فضای کاری، تمام فعالیت‌های تیم
          </span>
        </div>

        {/* Main content */}
        <div className="relative flex min-h-0 flex-1 flex-col justify-center py-4">
          <div className="max-w-lg">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold">
              <CheckCircle2 size={15} />
              مدیریت منظم‌تر، همکاری بهتر
            </div>

            <h2 className="text-3xl font-extrabold leading-[1.55] xl:text-4xl">
              پروژه‌ها رو
              <span className="block text-emerald-100">
                با دیدی روشن‌تر
              </span>
              مدیریت کن.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-7 text-emerald-50/90">
              از برنامه‌ریزی پروژه و تقسیم وظایف
              تا پیگیری اسپرینت‌ها و پیشرفت واقعی؛
              همه‌چیز در یک محیط فارسی و یکپارچه.
            </p>

            {/* Compact feature cards */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/15"
                  >
                    <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-white/15">
                      <Icon size={17} />
                    </div>

                    <h3 className="text-xs font-bold">
                      {feature.title}
                    </h3>

                    <p className="mt-1 text-[11px] leading-5 text-emerald-50/80">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Progress preview */}
            <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm [@media(max-height:760px)]:hidden">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-emerald-100">
                    نمونه نمایش پیشرفت پروژه
                  </p>

                  <p className="mt-1 text-xl font-extrabold">
                    ۷۵٪
                  </p>
                </div>

                <div className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                  <Activity size={19} />
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-3/4 rounded-full bg-white" />
              </div>

              <p className="mt-2 text-[10px] text-emerald-50/80">
                صرفاً نمونه نمایشی از پیشرفت خودکار
              </p>
            </div>
          </div>
        </div>

        {/* Panel footer */}
        <div className="relative flex shrink-0 items-center justify-between gap-4 border-t border-white/20 pt-4">
          <div className="flex items-center gap-2 text-xs text-emerald-50">
            <CalendarDays size={16} />
            تقویم شمسی و زمان‌بندی فعالیت‌ها
          </div>

          <span className="text-xs text-emerald-100">
            مدیریت ساده‌تر
          </span>
        </div>
      </aside>
    </div>
  );
}

function LoginPageLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3">
      <LoaderCircle
        size={24}
        className="animate-spin text-emerald-600"
      />

      <p
        className="text-sm"
        style={{ color: "var(--muted)" }}
      >
        در حال بررسی وضعیت ورود...
      </p>
    </div>
  );
}
