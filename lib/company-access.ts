import "server-only";

import type { CompanyMemberRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/role-access";

export type CompanyActor = {
  id: string;
  role: AppRole;
};

export type CompanyAccess = {
  companyId: string;
  role: CompanyMemberRole | "PLATFORM_ADMIN";
  isPlatformAdmin: boolean;
};

/**
 * Returns access only when the actor may operate inside the requested company.
 * Platform admins can inspect suspended companies; company members cannot.
 */
export async function getCompanyAccess(
  actor: CompanyActor,
  companyId: string,
): Promise<CompanyAccess | null> {
  if (actor.role === "ADMIN") {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    return company
      ? { companyId: company.id, role: "PLATFORM_ADMIN", isPlatformAdmin: true }
      : null;
  }

  const membership = await prisma.companyMember.findFirst({
    where: {
      companyId,
      userId: actor.id,
      isActive: true,
      company: { status: "ACTIVE" },
    },
    select: { companyId: true, role: true },
  });

  return membership
    ? { companyId: membership.companyId, role: membership.role, isPlatformAdmin: false }
    : null;
}

export function canManageCompany(access: CompanyAccess) {
  return access.isPlatformAdmin || access.role === "OWNER" || access.role === "ADMIN";
}

export function canCreateCompanyProject(access: CompanyAccess) {
  return canManageCompany(access) || access.role === "PROJECT_MANAGER";
}
