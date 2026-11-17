import "server-only";

import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const DAY = 86_400_000;

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function notifyTaskDeadlines(now = new Date()) {
  const today = startOfUtcDay(now);
  const soon = new Date(today.getTime() + 3 * DAY);
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      assigneeId: { not: null },
      status: { not: "DONE" },
      dueDate: { not: null, lte: soon },
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      assigneeId: true,
      dueDate: true,
    },
  });

  let dueSoonCount = 0;
  let overdueCount = 0;

  await Promise.all(tasks.map(async (task) => {
    if (!task.assigneeId || !task.dueDate) return;

    const dueDay = startOfUtcDay(task.dueDate);
    const difference = Math.round((dueDay.getTime() - today.getTime()) / DAY);
    const dueKey = dueDay.toISOString().slice(0, 10);

    if (difference < 0) {
      overdueCount += 1;
      await createNotification({
        userId: task.assigneeId,
        type: "TASK_OVERDUE",
        title: "مهلت وظیفه گذشته است",
        body: `مهلت وظیفه «${task.title}» گذشته است.`,
        href: `/projects/${task.projectId}/tasks`,
        projectId: task.projectId,
        payload: { taskId: task.id, dueDate: dueKey },
        dedupeKey: `task-overdue:${task.id}:${today.toISOString().slice(0, 10)}`,
      });
      return;
    }

    dueSoonCount += 1;
    const timeLabel = difference === 0 ? "امروز" : difference === 1 ? "فردا" : `${difference.toLocaleString("fa-IR")} روز دیگر`;
    await createNotification({
      userId: task.assigneeId,
      type: "TASK_DUE_SOON",
      title: "سررسید وظیفه نزدیک است",
      body: `مهلت وظیفه «${task.title}» ${timeLabel} است.`,
      href: `/projects/${task.projectId}/tasks`,
      projectId: task.projectId,
      payload: { taskId: task.id, dueDate: dueKey },
      dedupeKey: `task-due-soon:${task.id}:${dueKey}`,
    });
  }));

  return { dueSoonCount, overdueCount };
}
