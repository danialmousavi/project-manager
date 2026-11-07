
import Link from "next/link";

import {
  Activity,
  ArrowLeft,
  ArrowUpLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const features = [
  {
    title: "مدیریت پروژه‌ها",
    description:
      "ساخت و مدیریت پروژه‌ها، تعیین اعضا و پیگیری فعالیت‌ها در یک محیط یکپارچه.",
    icon: FolderKanban,
  },
  {
    title: "مدیریت وظایف",
    description:
      "تعریف، اولویت‌بندی، تخصیص و پیگیری وظایف با تاریخ‌های شمسی.",
    icon: ListTodo,
  },
  {
    title: "اسپرینت و زمان‌بندی",
    description:
      "برنامه‌ریزی اسپرینت‌ها و مشاهده زمان‌بندی تسک‌ها روی تقویم تعاملی.",
    icon: CalendarDays,
  },
  {
    title: "برد کانبان",
    description:
      "مدیریت بصری وظایف با جابه‌جایی کارت‌ها بین مراحل مختلف انجام کار.",
    icon: Layers3,
  },
  {
    title: "پیشرفت خودکار",
    description:
      "محاسبه پیشرفت پروژه از وضعیت واقعی وظایف، بدون ورود دستی درصد.",
    icon: Activity,
  },
  {
    title: "مدیریت دسترسی",
    description:
      "کنترل دسترسی مدیر اصلی، مدیر پروژه و کارمند متناسب با مسئولیت‌ها.",
    icon: ShieldCheck,
  },
];

const steps = [
  {
    number: "۰۱",
    title: "پروژه بسازید",
    description:
      "پروژه جدید تعریف کنید و اهداف، تاریخ‌ها و اعضای آن را مشخص کنید.",
    icon: FolderKanban,
  },
  {
    number: "۰۲",
    title: "کارها را تقسیم کنید",
    description:
      "وظایف را ایجاد کنید، مسئول تعیین کنید و برای انجام آن‌ها برنامه بریزید.",
    icon: Users,
  },
  {
    number: "۰۳",
    title: "پیشرفت را ببینید",
    description:
      "با کانبان و گزارش پیشرفت خودکار، وضعیت کارها را دنبال کنید.",
    icon: CheckCircle2,
  },
];

const previewColumns = [
  {
    title: "برای انجام",
    count: "۳",
    color: "bg-slate-400",
    background: "bg-slate-50",
    tasks: [
      {
        title: "بررسی نیازمندی‌ها",
        detail: "اولویت متوسط",
      },
      {
        title: "طراحی ساختار صفحات",
        detail: "اولویت زیاد",
      },
    ],
  },
  {
    title: "در حال انجام",
    count: "۲",
    color: "bg-sky-500",
    background: "bg-sky-50",
    tasks: [
      {
        title: "پیاده‌سازی بخش پروژه",
        detail: "در حال اجرا",
      },
    ],
  },
  {
    title: "انجام‌شده",
    count: "۴",
    color: "bg-emerald-600",
    background: "bg-emerald-50",
    tasks: [
      {
        title: "راه‌اندازی پایگاه داده",
        detail: "تکمیل‌شده",
      },
      {
        title: "احراز هویت کاربران",
        detail: "تکمیل‌شده",
      },
    ],
  },
];

export default function HomePage() {
  return (
    <main
      id="main-content"
      dir="rtl"
      className="min-h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 py-5">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="صفحه اصلی مدیر پروژه"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/15">
              <Layers3 size={25} />
            </div>

            <div>
              <h1 className="text-lg font-extrabold">
                مدیر پروژه
              </h1>

              <p
                className="mt-1 text-xs"
                style={{ color: "var(--muted)" }}
              >
                فضای یکپارچه مدیریت کارها
              </p>
            </div>
          </Link>

          <nav
            aria-label="ناوبری اصلی"
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:px-5 sm:text-sm"
            >
              <LockKeyhole size={16} />
              ورود به حساب
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-lg shadow-emerald-600/15 transition hover:bg-emerald-700 sm:px-5 sm:text-sm"
            >
              داشبورد
              <ArrowLeft size={17} />
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="relative pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
          <div className="pointer-events-none absolute -right-40 top-0 size-[420px] rounded-full bg-emerald-100/70 blur-3xl" />

          <div className="pointer-events-none absolute -left-32 bottom-0 size-[350px] rounded-full bg-emerald-50 blur-3xl" />

          <div className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
            {/* Hero content */}
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
                <Sparkles size={16} />
                مدیریت هوشمندتر پروژه‌ها و وظایف
              </div>

              <h2 className="max-w-2xl text-3xl font-black leading-[1.9] tracking-tight sm:text-4xl sm:leading-[1.8] xl:text-5xl">
                پروژه‌ها را
                <span className="text-emerald-600">
                  {" "}
                  منظم‌تر{" "}
                </span>
                مدیریت کنید،
                <span className="text-emerald-600">
                  {" "}
                  پیشرفت را دقیق‌تر{" "}
                </span>
                ببینید.
              </h2>

              <p
                className="mt-6 max-w-xl text-sm leading-9 sm:text-base"
                style={{ color: "var(--muted)" }}
              >
                از تعریف پروژه و تقسیم وظایف
                تا مدیریت اسپرینت‌ها، برد کانبان
                و مشاهده پیشرفت واقعی؛
                تمام فعالیت‌های تیم را در
                یک فضای ساده، فارسی و یکپارچه
                مدیریت کنید.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/projects"
                  className="group inline-flex h-13 min-h-13 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/15 transition hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  <FolderKanban size={19} />
                  مشاهده پروژه‌ها
                  <ArrowLeft
                    size={18}
                    className="transition-transform group-hover:-translate-x-1"
                  />
                </Link>

                <Link
                  href="/dashboard"
                  className="inline-flex h-13 min-h-13 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-6 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <LayoutDashboard size={18} />
                  ورود به داشبورد
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2
                    size={17}
                    className="text-emerald-600"
                  />
                  محیط کاملاً فارسی
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CalendarDays
                    size={17}
                    className="text-emerald-600"
                  />
                  تقویم شمسی
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ShieldCheck
                    size={17}
                    className="text-emerald-600"
                  />
                  مدیریت دسترسی
                </div>
              </div>
            </div>

            {/* Product preview */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-[36px] bg-emerald-100/60 blur-2xl" />

              <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10">
                {/* Preview header */}
                <div className="flex items-center justify-between gap-3 border-b border-emerald-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <FolderKanban size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-bold">
                        فضای کاری پروژه
                      </p>

                      <p className="mt-1 text-[11px] text-slate-400">
                        نمای نمونه سامانه
                      </p>
                    </div>
                  </div>

                  <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                    در حال اجرا
                  </span>
                </div>

                {/* Preview progress */}
                <div className="border-b border-emerald-100 px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        پیشرفت پروژه
                      </p>

                      <p className="mt-2 text-2xl font-extrabold text-emerald-600">
                        ۷۵٪
                      </p>
                    </div>

                    <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Activity size={22} />
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-emerald-100">
                    <div className="h-full w-3/4 rounded-full bg-emerald-600" />
                  </div>

                  <p className="mt-3 text-[11px] text-slate-400">
                    داده نمونه برای نمایش قابلیت گزارش پیشرفت
                  </p>
                </div>

                {/* Preview kanban */}
                <div className="px-4 py-5 sm:px-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold">
                      نمای کانبان
                    </h3>

                    <span className="text-[11px] text-slate-400">
                      پیش‌نمایش
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {previewColumns.map((column) => (
                      <div
                        key={column.title}
                        className={`min-w-0 rounded-xl p-2 ${column.background}`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`size-2 shrink-0 rounded-full ${column.color}`}
                            />

                            <span className="text-[9px] font-bold text-slate-700 sm:text-[10px]">
                              {column.title}
                            </span>
                          </div>

                          <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                            {column.count}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {column.tasks.map((task) => (
                            <div
                              key={task.title}
                              className="min-h-18 rounded-lg border border-white bg-white p-2 shadow-sm"
                            >
                              <p className="text-[10px] font-semibold leading-5 text-slate-700">
                                {task.title}
                              </p>

                              <p className="mt-2 text-[9px] text-slate-400">
                                {task.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 bg-emerald-50/40 px-5 py-4">
                  <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                    <CheckCircle2 size={16} />
                    پیگیری شفاف فعالیت‌ها
                  </div>

                  <span className="text-[11px] text-slate-500">
                    طراحی هماهنگ با سامانه
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="pb-14 sm:pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            <Highlight
              icon={<FolderKanban size={22} />}
              title="همه پروژه‌ها در یک جا"
              description="مشاهده اطلاعات، اعضا و وضعیت پروژه‌ها از یک فضای کاری مشترک."
            />

            <Highlight
              icon={<Clock3 size={22} />}
              title="زمان‌بندی شفاف"
              description="پیگیری تاریخ شروع و پایان کارها با تقویم فارسی و تایم‌لاین."
            />

            <Highlight
              icon={<Activity size={22} />}
              title="پیشرفت مبتنی بر داده"
              description="محاسبه درصد پیشرفت با توجه به وضعیت واقعی وظایف پروژه."
            />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="border-t border-emerald-100 py-14 sm:py-20"
        >
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                <Sparkles size={15} />
                امکانات سامانه
              </div>

              <h2 className="text-2xl font-extrabold sm:text-3xl">
                ابزارهای موردنیاز برای مدیریت پروژه
              </h2>

              <p
                className="mt-4 max-w-2xl text-sm leading-8"
                style={{ color: "var(--muted)" }}
              >
                بخش‌های مختلف سامانه به یکدیگر
                متصل هستند تا اطلاعات وظایف،
                وضعیت کارها و پیشرفت پروژه
                در نماهای مختلف قابل پیگیری باشند.
              </p>
            </div>

            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-600"
            >
              مشاهده پروژه‌ها
              <ArrowLeft size={17} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-950/5"
                >
                  <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
                    <Icon size={23} />
                  </div>

                  <h3 className="text-base font-bold">
                    {feature.title}
                  </h3>

                  <p
                    className="mt-3 text-sm leading-8"
                    style={{ color: "var(--muted)" }}
                  >
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Workflow */}
        <section className="border-t border-emerald-100 py-14 sm:py-20">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
              روند کار
            </span>

            <h2 className="mt-5 text-2xl font-extrabold sm:text-3xl">
              از ایده تا انجام، در سه قدم
            </h2>

            <p
              className="mx-auto mt-4 max-w-xl text-sm leading-8"
              style={{ color: "var(--muted)" }}
            >
              برای شروع، کافی است پروژه‌تان را
              تعریف کنید، وظایف را بین اعضا
              تقسیم کنید و پیشرفت را دنبال کنید.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.number}
                  className="relative rounded-3xl border border-emerald-100 bg-white p-7 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-extrabold text-emerald-200">
                      {step.number}
                    </span>

                    <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Icon size={21} />
                    </div>
                  </div>

                  <h3 className="mt-6 text-lg font-extrabold">
                    {step.title}
                  </h3>

                  <p
                    className="mt-3 text-sm leading-8"
                    style={{ color: "var(--muted)" }}
                  >
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-16 pt-4 sm:pb-24">
          <div className="relative overflow-hidden rounded-[30px] bg-emerald-600 p-7 text-white shadow-xl shadow-emerald-600/15 sm:p-12">
            <div className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />

            <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-emerald-300/20 blur-2xl" />

            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="max-w-2xl">
                <div className="mb-4 flex items-center gap-2 text-emerald-100">
                  <Sparkles size={19} />
                  <span className="text-xs font-semibold">
                    فضای کاری یکپارچه
                  </span>
                </div>

                <h2 className="text-2xl font-extrabold leading-10 sm:text-3xl">
                  مدیریت پروژه‌ها را منظم‌تر شروع کنید.
                </h2>

                <p className="mt-4 text-sm leading-8 text-emerald-50">
                  پروژه‌ها، وظایف و زمان‌بندی‌های تیم را
                  در یک سامانه فارسی مدیریت کنید
                  و تصویر روشن‌تری از پیشرفت
                  فعالیت‌ها داشته باشید.
                </p>
              </div>

              <Link
                href="/projects"
                className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-emerald-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50"
              >
                ورود به فضای پروژه‌ها
                <ArrowUpLeft size={19} />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-emerald-100 py-7">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Layers3 size={16} />
            </div>

            <span className="text-xs font-semibold">
              سامانه مدیر پروژه
            </span>
          </div>

          <p
            className="text-xs"
            style={{ color: "var(--muted)" }}
          >
            مدیریت یکپارچه پروژه‌ها، وظایف
            و فعالیت‌های تیم
          </p>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-600"
          >
            داشبورد
            <ChevronLeft size={15} />
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Highlight({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-bold">
          {title}
        </h3>

        <p
          className="mt-2 text-xs leading-7"
          style={{ color: "var(--muted)" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
