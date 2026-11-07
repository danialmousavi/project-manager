import type { Prisma, TaskStatus } from "@/generated/prisma/client";

export const TASK_PROGRESS_WEIGHT: Record<TaskStatus, number> = {
  TODO: 0,
  IN_PROGRESS: 50,
  IN_REVIEW: 90,
  DONE: 100,
};

export type TaskStatusCount = {
  status: TaskStatus;
  count: number;
};

export function calculateProjectProgress(
  groups: readonly TaskStatusCount[]
): number {
  let total = 0;
  let weightedTotal = 0;

  for (const group of groups) {
    total += group.count;
    weightedTotal += group.count * TASK_PROGRESS_WEIGHT[group.status];
  }

  return total === 0 ? 0 : Math.round(weightedTotal / total);
}

type ProgressClient = Pick<
  Prisma.TransactionClient,
  "task" | "project"
>;

export async function calculateProjectProgressFromDb(
  db: ProgressClient,
  projectId: string
): Promise<number> {
  const groups = await db.task.groupBy({
    by: ["status"],
    where: { projectId, deletedAt: null },
    _count: { _all: true },
  });

  return calculateProjectProgress(
    groups.map((group) => ({
      status: group.status,
      count: group._count._all,
    }))
  );
}

/**
 * Project.progress is a derived cache for backwards compatibility.
 * Task rows are the source of truth and all product reads calculate from them.
 */
export async function syncProjectProgressCache(
  db: ProgressClient,
  projectId: string
): Promise<number> {
  const progress = await calculateProjectProgressFromDb(db, projectId);

  await db.project.update({
    where: { id: projectId },
    data: { progress },
  });

  return progress;
}
