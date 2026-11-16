
import "server-only";

import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/role-access";

type ProjectActor = {
  id: string;
  role: AppRole;
};

export async function canEditProject(
  actor: ProjectActor,
  projectId: string
): Promise<boolean> {
  if (actor.role === "EMPLOYEE" || actor.role === "CONTROLLER") {
    return false;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      archivedAt: null,
      ...(actor.role === "ADMIN"
        ? {}
        : {
            members: {
              some: {
                userId: actor.id,
                role: "MANAGER",
              },
            },
          }),
    },
    select: {
      id: true,
    },
  });

  return Boolean(project);
}
