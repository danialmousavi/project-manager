import "server-only";

import { createNotification, createNotificationsForUsers } from "@/lib/notifications";

type SprintNotificationInput = {
  projectId: string;
  sprintId: string;
  sprintName: string;
  recipientIds: Iterable<string | null>;
  actorId: string;
};

function recipients(ids: Iterable<string | null>) {
  return [...ids].filter((id): id is string => Boolean(id));
}

export async function notifySprintStarted(input: SprintNotificationInput) {
  try {
    await createNotificationsForUsers(recipients(input.recipientIds), {
      actorId: input.actorId,
      type: "SPRINT_STARTED",
      title: "اسپرینت شروع شد",
      body: `اسپرینت «${input.sprintName}» شروع شد.`,
      href: `/projects/${input.projectId}/sprints`,
      projectId: input.projectId,
      payload: { sprintId: input.sprintId },
      dedupeKey: `sprint-started:${input.sprintId}`,
    });
  } catch (error) {
    console.error("Create sprint-start notification:", error);
  }
}

export async function notifySprintCompleted(input: SprintNotificationInput) {
  try {
    await createNotificationsForUsers(recipients(input.recipientIds), {
      actorId: input.actorId,
      type: "SPRINT_COMPLETED",
      title: "اسپرینت پایان یافت",
      body: `اسپرینت «${input.sprintName}» پایان یافت.`,
      href: `/projects/${input.projectId}/sprints`,
      projectId: input.projectId,
      payload: { sprintId: input.sprintId },
      dedupeKey: `sprint-completed:${input.sprintId}`,
    });
  } catch (error) {
    console.error("Create sprint-completed notification:", error);
  }
}

export async function notifyTaskSprintMoved(input: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  recipientId: string | null;
  actorId: string;
  sprintId: string | null;
  sprintName: string | null;
}) {
  if (!input.recipientId) return;

  try {
    await createNotification({
      userId: input.recipientId,
      actorId: input.actorId,
      type: "SPRINT_TASK_MOVED",
      title: "اسپرینت وظیفه تغییر کرد",
      body: input.sprintName
        ? `وظیفه «${input.taskTitle}» به اسپرینت «${input.sprintName}» منتقل شد.`
        : `وظیفه «${input.taskTitle}» به بک‌لاگ بازگشت.`,
      href: `/projects/${input.projectId}/sprints`,
      projectId: input.projectId,
      payload: { taskId: input.taskId, sprintId: input.sprintId },
      dedupeKey: `sprint-task-moved:${input.taskId}:${input.sprintId ?? "backlog"}`,
    });
  } catch (error) {
    console.error("Create sprint-task notification:", error);
  }
}
