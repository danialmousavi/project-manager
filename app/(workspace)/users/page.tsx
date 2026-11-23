
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess } from "@/lib/workspace-access";
import { canManageCompanyRole } from "@/lib/access-policy";
import { pageGuides } from "@/lib/page-guides";
import UsersManager from "@/components/users/users-manager";
import PageGuide from "@/components/ui/page-guide";

export default function UsersPage() {
  return (
    <main id="main-content" className="min-h-dvh bg-[var(--background)] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
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

  const workspace = await getWorkspaceAccess(currentUser);
  const managedCompanyIds = workspace.companyMemberships.filter((membership) => canManageCompanyRole(membership.role)).map((membership) => membership.companyId);
  if (currentUser.role !== "ADMIN" && managedCompanyIds.length === 0) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: currentUser.role === "ADMIN" ? {} : { companyMemberships: { some: { companyId: { in: managedCompanyIds } } } },
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
      companyMemberships: {
        orderBy: {
          company: {
            name: "asc",
          },
        },
        select: {
          role: true,
          isActive: true,
          company: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const serializedUsers = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
  }));
  const companies = await prisma.company.findMany({ where: { status: "ACTIVE", ...(currentUser.role === "ADMIN" ? {} : { id: { in: managedCompanyIds } }) }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck size={21} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl">
              مدیریت کاربران
            </h1>

            <p className="mt-0.5 text-sm text-[var(--muted)]">
              ساخت حساب کاربری و مشاهدهٔ نقش‌های واقعی کاربران در شرکت‌ها
            </p>
          </div>
        </div>
        <PageGuide guide={pageGuides.users} />
      </div>

      <UsersManager initialUsers={serializedUsers} companies={companies} canCreatePlatformAdmin={currentUser.role === "ADMIN"} />
    </>
  );
}

function UsersLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <LoaderCircle
        size={32}
        className="animate-spin text-emerald-600"
      />

      <p className="text-sm text-slate-500">
        در حال دریافت اطلاعات کاربران...
      </p>
    </div>
  );
}
