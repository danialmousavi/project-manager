
import { redirect } from "next/navigation";
import { Layers3, ShieldCheck, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "../../components/auth/login-form";

export const instant = false;

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f7fcf9] lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
              <Layers3 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                مدیر پروژه
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                سامانه مدیریت پروژه و وظایف
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
            <h2 className="text-2xl font-extrabold text-slate-900">
              خوش برگشتی!
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              برای ورود به پنل، اطلاعات حساب کاربری خودت
              رو وارد کن.
            </p>

            <div className="mt-8">
              <LoginForm />
            </div>
          </div>

          <p className="mt-7 text-center text-xs text-slate-400">
            نسخه نمایشی سامانه مدیریت پروژه
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-[#25235b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-32 top-1/4 size-96 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-96 rounded-full bg-purple-500/30 blur-3xl" />

        <div className="relative flex items-center gap-2 text-sm text-emerald-200">
          <ShieldCheck size={20} />
          مدیریت ساده و منظم
        </div>

        <div className="relative max-w-lg">
          <div className="mb-8 inline-flex rounded-2xl bg-white/10 p-4">
            <CheckCircle2 size={32} />
          </div>

          <h2 className="text-4xl font-bold leading-[1.8]">
            همه پروژه‌ها،
            <br />
            در یک نگاه.
          </h2>

          <p className="mt-6 text-lg leading-9 text-emerald-100/80">
            پروژه بساز، وظایف رو مدیریت کن و پیشرفت
            کارها رو با یک تجربه ساده و حرفه‌ای دنبال کن.
          </p>
        </div>

        <p className="relative text-sm text-emerald-200/70">
          ساده‌تر برنامه‌ریزی کن، بهتر نتیجه بگیر.
        </p>
      </div>
    </main>
  );
}
