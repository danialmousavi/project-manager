import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { canManageCompany, getCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import CompanyMembersManager from "@/components/companies/company-members-manager";

export default async function CompanyMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const { id } = await params;
  const access = await getCompanyAccess(actor, id);
  if (!access || !canManageCompany(access)) redirect("/dashboard");

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      name: true,
      status: true,
      members: {
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        select: { id: true, role: true, isActive: true, joinedAt: true, user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
      },
    },
  });
  if (!company) redirect("/dashboard");

  return <main id="main-content" className="min-h-dvh bg-[var(--background)] px-4 py-5 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl">
    <header className="mb-6 flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={21} /></div><div><h1 className="text-xl font-extrabold sm:text-2xl">اعضای {company.name}</h1><p className="mt-1 text-sm text-[var(--muted)]">افزودن، تغییر نقش و حذف عضویت اعضای شرکت.</p></div></header>
    <CompanyMembersManager companyId={id} initialMembers={company.members} canManageOwner={access.isPlatformAdmin} />
  </div></main>;
}
