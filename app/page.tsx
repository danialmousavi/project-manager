
import {
  ArrowLeft,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  FolderKanban,
  Layers3,
  ListTodo,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const features = [
  {
    title: "مدیریت پروژه‌ها",
    description: "ساخت پروژه، تعیین مسئول و پیگیری پیشرفت",
    icon: FolderKanban,
  },
  {
    title: "مدیریت وظایف",
    description: "تخصیص وظایف و مدیریت زمان تحویل",
    icon: ListTodo,
  },
  {
    title: "اسپرینت‌ها",
    description: "برنامه‌ریزی و ثبت میزان پیشرفت کارها",
    icon: CalendarDays,
  },
  {
    title: "نمایش‌های کاربردی",
    description: "مشاهده وظایف در لیست، برد و گانت",
    icon: Layers3,
  },
  {
    title: "گزارش پیشرفت",
    description: "نمایش وضعیت پروژه‌ها در یک نگاه",
    icon: ChartNoAxesCombined,
  },
  {
    title: "مدیریت دسترسی",
    description: "دسترسی متناسب با نقش و پروژه",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Layers3 size={22} />
            </div>

            <div>
              <h1 className="text-lg font-bold">
                مدیر پروژه
              </h1>
              <p className="text-xs text-slate-500">
                مدیریت هوشمند کارها
              </p>
            </div>
          </div>

          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-700">
            نسخه اولیه MVP
          </span>
        </header>

        <section className="relative mt-16 overflow-hidden rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm sm:p-12 lg:mt-24 lg:p-16">
          <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-indigo-100/70 blur-3xl" />

          <div className="relative max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-700">
              <Sparkles size={16} />
              مدیریت ساده‌تر، پیشرفت سریع‌تر
            </div>

            <h2 className="text-3xl font-extrabold leading-[1.8] tracking-tight sm:text-5xl">
              پروژه‌هات رو
              <span className="text-indigo-600">
                {" "}ساده‌تر{" "}
              </span>
              مدیریت کن.
            </h2>

            <p className="mt-6 max-w-xl text-sm leading-8 text-slate-500 sm:text-base">
              پروژه‌ها، وظایف، اسپرینت‌ها و گزارش پیشرفت
              رو در یک محیط ساده و حرفه‌ای مدیریت کن.
              همه‌چیز در یک جا، بدون پیچیدگی‌های اضافی.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white">
                <CheckCircle2 size={18} />
                در حال آماده‌سازی
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                نسخه نمایشی محصول
                <ArrowLeft size={17} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 pb-16">
          <div className="mb-6">
            <h3 className="text-xl font-bold">
              امکانات اصلی سیستم
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              قابلیت‌هایی که در نسخه MVP پیاده‌سازی می‌کنیم
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Icon size={23} />
                  </div>

                  <h4 className="text-base font-bold">
                    {feature.title}
                  </h4>

                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          سامانه مدیریت پروژه — نسخه نمایشی
        </footer>
      </div>
    </main>
  );
}
