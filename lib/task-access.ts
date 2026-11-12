
import "server-only";

import { prisma } from "@/lib/prisma";
import { canViewAllProjects, type AppRole } from "@/lib/role-access";

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
      ...(canViewAllProjects(actor.role)
        ? {}
        : {
            members: {
              some: {
                userId: actor.id,
              },
            },
          }),
    },
    select: {
      id: true,
      members: {
        where: { userId: actor.id },
        select: { role: true },
      },
    },
  });

  if (!project) return null;

  return {
    projectId,
    canManage:
      actor.role === "ADMIN" ||
      (actor.role === "MANAGER" &&
        project.members.some(
          (member) => member.role === "MANAGER"
        )),
  };
}
