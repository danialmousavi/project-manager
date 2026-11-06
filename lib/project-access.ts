
import "server-only";

import { prisma } from "@/lib/prisma";

type ProjectActor = {
  id: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

export async function canEditProject(
  actor: ProjectActor,
  projectId: string
): Promise<boolean> {
  if (actor.role === "EMPLOYEE") {
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
