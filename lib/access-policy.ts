import type { CompanyMemberRole } from "@/generated/prisma/client";

export type PlatformRole = "PLATFORM_ADMIN";
export type EffectiveRole = PlatformRole | CompanyMemberRole;

const companyRolePriority: Record<CompanyMemberRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  PROJECT_MANAGER: 3,
  CONTROLLER: 2,
  EXPERT: 1,
};

export const effectiveRoleLabels: Record<EffectiveRole, string> = {
  PLATFORM_ADMIN: "مدیر اصلی سامانه",
  OWNER: "مالک شرکت",
  ADMIN: "مدیر شرکت",
  PROJECT_MANAGER: "مدیر پروژه",
  EXPERT: "کارشناس",
  CONTROLLER: "ناظر کنترل پروژه",
};

export function getHighestCompanyRole(
  roles: readonly CompanyMemberRole[],
): CompanyMemberRole | null {
  return roles.reduce<CompanyMemberRole | null>((highest, role) => {
    if (!highest || companyRolePriority[role] > companyRolePriority[highest]) {
      return role;
    }

    return highest;
  }, null);
}

export function canManageCompanyRole(role: EffectiveRole) {
  return role === "PLATFORM_ADMIN" || role === "OWNER" || role === "ADMIN";
}

export function canCreateCompanyProjectRole(role: EffectiveRole) {
  return canManageCompanyRole(role) || role === "PROJECT_MANAGER";
}

export function canManageProjectAsMember(
  companyRole: CompanyMemberRole | undefined,
  isProjectManager: boolean,
) {
  return Boolean(
    companyRole &&
      (canManageCompanyRole(companyRole) ||
        (companyRole === "PROJECT_MANAGER" && isProjectManager)),
  );
}
