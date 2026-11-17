import "server-only";

import { createNotification } from "@/lib/notifications";

type TaskNotificationInput = {
  taskId: string;
  taskTitle: string;
  projectId: string;
  recipientId: string;
  actorId: string;
};

const statusLabels: Record<string, string> = {
  TODO: "انجام‌نشده",
  IN_PROGRESS: "در حال انجام",
  IN_REVIEW: "در انتظار بررسی",
  DONE: "انجام‌شده",
};

function taskHref(projectId: string) {
  return `/projects/${projectId}/tasks`;
}

export async function notifyTaskAssigned(input: TaskNotificationInput) {
  try {
    await createNotification({
      userId: input.recipientId,
      actorId: input.actorId,
      type: "TASK_ASSIGNED",
      title: "وظیفه‌ای به شما واگذار شد",
      body: `وظیفه «${input.taskTitle}» به شما واگذار شد.`,
      href: taskHref(input.projectId),
      projectId: input.projectId,
      payload: { taskId: input.taskId },
      dedupeKey: `task-assigned:${input.taskId}:${input.recipientId}`,
    });
  } catch (error) {
    console.error("Create task-assignment notification:", error);
  }
}

export async function notifyTaskStatusChanged(
  input: TaskNotificationInput & { status: string },
) {
  try {
    await createNotification({
      userId: input.recipientId,
      actorId: input.actorId,
      type: "TASK_UPDATED",
      title: "وضعیت وظیفه تغییر کرد",
      body: `وضعیت «${input.taskTitle}» به «${statusLabels[input.status] ?? input.status}» تغییر کرد.`,
      href: taskHref(input.projectId),
      projectId: input.projectId,
      payload: { taskId: input.taskId, status: input.status },
      dedupeKey: `task-status:${input.taskId}:${input.recipientId}:${input.status}`,
    });
  } catch (error) {
    console.error("Create task-status notification:", error);
  }
}

export async function notifyTaskCommented(
  input: TaskNotificationInput & {
    commentId: string;
    authorName: string;
    content: string;
  },
) {
  try {
    const excerpt = input.content.length > 160
      ? `${input.content.slice(0, 157)}…`
      : input.content;

    await createNotification({
      userId: input.recipientId,
      actorId: input.actorId,
      type: "TASK_COMMENTED",
      title: "کامنت جدید روی وظیفه",
      body: `${input.authorName} در «${input.taskTitle}» نوشت: ${excerpt}`,
      href: taskHref(input.projectId),
      projectId: input.projectId,
      payload: { taskId: input.taskId, commentId: input.commentId },
      dedupeKey: `task-comment:${input.commentId}:${input.recipientId}`,
    });
  } catch (error) {
    console.error("Create task-comment notification:", error);
  }
}
