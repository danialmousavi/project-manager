import "server-only";

import { randomUUID } from "node:crypto";
import type { NotificationType, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  href: string;
  projectId?: string | null;
  payload?: Prisma.InputJsonValue;
  /** Use the same key for one logical event to prevent duplicate notifications. */
  dedupeKey?: string;
};

/**
 * Creates an in-app notification for one user.
 *
 * The actor never receives a notification for their own operation. When a
 * dedupeKey is supplied, calling this function repeatedly for the same user
 * and event updates the existing unread notification instead of duplicating it.
 */
export async function createNotification(input: CreateNotificationInput) {
  if (input.actorId && input.actorId === input.userId) return null;

  const data = {
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href,
    projectId: input.projectId ?? null,
    payload: input.payload,
  };

  if (!input.dedupeKey) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        dedupeKey: randomUUID(),
        ...data,
      },
    });
  }

  return prisma.notification.upsert({
    where: {
      userId_dedupeKey: {
        userId: input.userId,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      userId: input.userId,
      dedupeKey: input.dedupeKey,
      ...data,
    },
    update: {
      ...data,
      readAt: null,
      createdAt: new Date(),
    },
  });
}

export async function createNotificationsForUsers(
  userIds: Iterable<string>,
  input: Omit<CreateNotificationInput, "userId">
) {
  const uniqueUserIds = [...new Set(userIds)];

  return Promise.all(
    uniqueUserIds.map((userId) => createNotification({ ...input, userId }))
  );
}
