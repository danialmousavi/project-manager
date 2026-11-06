
import "server-only";

import { prisma } from "@/lib/prisma";

type Actor = {
  id: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

export async function getTaskProjectAccess(
  actor: Actor,
  projectId: string
) {
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
