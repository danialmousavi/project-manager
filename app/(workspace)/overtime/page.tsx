import { Clock3 } from "lucide-react";

import OvertimeManager from "@/components/overtime/overtime-manager";

export default function OvertimePage() {
  return <main id="main-content" className="min-h-dvh bg-[radial-gradient(circle_at_top_right,_#d1fae5,_transparent_34%),var(--background)] px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><header className="mb-5 flex flex-wrap items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Clock3 size={21} aria-hidden="true" /></div><div><h1 className="text-xl font-extrabold sm:text-2xl">اضافه‌کار من</h1><p className="mt-0.5 text-sm text-[var(--muted)]">تایمر را شروع کنید، در صورت نیاز متوقف کنید و پس از اطمینان ذخیره نهایی بزنید.</p></div></header><OvertimeManager /></div></main>;
}
