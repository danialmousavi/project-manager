
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UsersManager from "@/components/users/users-manager";

export default function UsersPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<UsersLoading />}>
          <UsersContent />
        </Suspense>
      </div>
    </main>
  );
}

async function UsersContent() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      nationalId: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const serializedUsers = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <>
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-indigo-600"
      >
        <ArrowRight size={17} />
        بازگشت به داشبورد
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <ShieldCheck size={27} />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            مدیریت کاربران
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            ساخت حساب کاربری، تعیین نقش و مدیریت اطلاعات کاربران
          </p>
        </div>
      </div>

      <UsersManager initialUsers={serializedUsers} />
    </>
  );
}

function UsersLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <LoaderCircle
        size={32}
        className="animate-spin text-indigo-600"
      />

      <p className="text-sm text-slate-500">
        در حال دریافت اطلاعات کاربران...
      </p>
    </div>
  );
}
