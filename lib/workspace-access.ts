import "server-only";

import type { CompanyMemberRole } from "@/generated/prisma/client";
import {
  effectiveRoleLabels,
  getHighestCompanyRole,
  type EffectiveRole,
} from "@/lib/access-policy";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/role-access";

export type WorkspaceActor = {
  id: string;
  role: AppRole;
};

export type WorkspaceCompanyMembership = {
  companyId: string;
  companyName: string;
  role: CompanyMemberRole;
};

export type WorkspaceAccess = {
  isPlatformAdmin: boolean;
  companyMemberships: WorkspaceCompanyMembership[];
  primaryRole: EffectiveRole | null;
  primaryRoleLabel: string;
};

/**
 * The workspace-wide source of truth for active company memberships.
 * The legacy User.role grants only platform-admin access; all operational
 * permissions are derived from CompanyMember records.
 */
export async function getWorkspaceAccess(
  actor: WorkspaceActor,
): Promise<WorkspaceAccess> {
  const memberships = await prisma.companyMember.findMany({
    where: {
      userId: actor.id,
      isActive: true,
      company: { status: "ACTIVE" },
    },
    select: {
      companyId: true,
      role: true,
      company: { select: { name: true } },
    },
    orderBy: { company: { name: "asc" } },
  });

  const companyMemberships = memberships.map((membership) => ({
    companyId: membership.companyId,
    companyName: membership.company.name,
    role: membership.role,
  }));
  const primaryRole = actor.role === "ADMIN"
    ? "PLATFORM_ADMIN"
    : getHighestCompanyRole(companyMemberships.map((membership) => membership.role));

  return {
    isPlatformAdmin: actor.role === "ADMIN",
    companyMemberships,
    primaryRole,
    primaryRoleLabel: primaryRole
      ? effectiveRoleLabels[primaryRole]
      : "بدون نقش فعال در شرکت",
  };
}
