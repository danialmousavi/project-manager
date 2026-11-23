import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import CompaniesManager from "@/components/companies/companies-manager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/dashboard");

  const [companies, users] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        projects: { where: { archivedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } },
        members: { where: { role: "OWNER", isActive: true }, select: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { members: true, projects: { where: { archivedAt: null } } } },
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  return (
    <main id="main-content" className="min-h-dvh bg-[var(--background)] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={21} /></div>
          <div><h1 className="text-xl font-extrabold sm:text-2xl">مدیریت شرکت‌ها</h1><p className="mt-0.5 text-sm text-[var(--muted)]">شرکت‌ها، مالک اولیه و وضعیت دسترسی آن‌ها را مدیریت کنید.</p></div>
        </div>
        <CompaniesManager initialCompanies={companies.map((company) => ({ ...company, createdAt: company.createdAt.toISOString() }))} activeUsers={users} />
      </div>
    </main>
  );
}
