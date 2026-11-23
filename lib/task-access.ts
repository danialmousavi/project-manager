
import "server-only";

import { prisma } from "@/lib/prisma";
import { canManageCompanyRole, canManageProjectAsMember } from "@/lib/access-policy";
import type { AppRole } from "@/lib/role-access";

type Actor = {
  id: string;
  role: AppRole;
};

export async function getTaskProjectAccess(
  actor: Actor,
  projectId: string
) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      archivedAt: null,
    },
    select: {
      id: true,
      company: {
        select: {
          status: true,
          members: {
            where: { userId: actor.id, isActive: true },
            select: { role: true },
          },
        },
      },
      members: {
        where: { userId: actor.id },
        select: { role: true },
      },
    },
  });

  if (!project) return null;

  const isPlatformAdmin = actor.role === "ADMIN";
  const companyRole = project.company.members[0]?.role;
  const isCompanyManager = companyRole
    ? canManageCompanyRole(companyRole)
    : false;
  const isProjectManager = project.members.some(
    (member) => member.role === "MANAGER"
  ) && companyRole === "PROJECT_MANAGER";
  const isProjectController = project.members.some(
    (member) => member.role === "CONTROLLER"
  ) && companyRole === "CONTROLLER";
  const isProjectMember = project.members.length > 0;

  if (
    !isPlatformAdmin &&
    (project.company.status !== "ACTIVE" ||
      (!isCompanyManager && !isProjectMember))
  ) {
    return null;
  }

  return {
    projectId,
    canManage: isPlatformAdmin || canManageProjectAsMember(companyRole, isProjectManager),
    canManageSettings: isPlatformAdmin || isCompanyManager,
    canChangeStatus: isPlatformAdmin || isCompanyManager || isProjectManager,
    canViewAllTasks: isPlatformAdmin || isCompanyManager || isProjectManager || isProjectController,
    isProjectController,
  };
}
