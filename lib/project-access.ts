
import "server-only";

import { getTaskProjectAccess } from "@/lib/task-access";
import type { AppRole } from "@/lib/role-access";

type ProjectActor = {
  id: string;
  role: AppRole;
};

export async function canEditProject(
  actor: ProjectActor,
  projectId: string
): Promise<boolean> {
  return Boolean((await getTaskProjectAccess(actor, projectId))?.canChangeStatus);
}
