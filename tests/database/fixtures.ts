import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";

export async function userFactory(
  db: PrismaClient,
  role: "ADMIN" | "MANAGER" | "EMPLOYEE" = "EMPLOYEE"
) {
  return db.user.create({
    data: {
      name: `Audit ${role}`,
      email: `audit-${randomUUID()}@example.invalid`,
      passwordHash: "fixture-only-no-login",
      role,
    },
  });
}

export async function projectFactory(
  db: PrismaClient,
  creatorId: string,
  managerId: string,
  memberIds: string[] = []
) {
  return db.project.create({
    data: {
      name: `Audit project ${randomUUID()}`,
      createdById: creatorId,
      members: {
        create: [
          { userId: managerId, role: "MANAGER" },
          ...memberIds.map((userId) => ({ userId, role: "MEMBER" as const })),
        ],
      },
    },
  });
}

export async function sprintFactory(db: PrismaClient, projectId: string) {
  return db.sprint.create({
    data: { name: `Audit sprint ${randomUUID()}`, projectId },
  });
}

export async function taskFactory(
  db: PrismaClient,
  projectId: string,
  creatorId: string,
  options: {
    sprintId?: string;
    assigneeId?: string;
    status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
    type?: "STORY" | "TASK" | "BUG";
    storyPoints?: number | null;
    rank?: number;
  } = {}
) {
  return db.task.create({
    data: {
      title: `Audit task ${randomUUID()}`,
      projectId,
      createdById: creatorId,
      ...options,
    },
  });
}

export async function commentFactory(
  db: PrismaClient,
  taskId: string,
  authorId: string,
  content = "Synthetic audit comment"
) {
  return db.taskComment.create({
    data: { taskId, authorId, content },
  });
}

export async function projectHistoryFactory(
  db: PrismaClient,
  projectId: string,
  updatedById: string
) {
  return db.progressHistory.create({
    data: { target: "PROJECT", projectId, updatedById, progress: 50 },
  });
}

export async function sessionFactory(
  db: PrismaClient,
  userId: string,
  expiresAt = new Date(Date.now() + 60_000)
) {
  return db.session.create({
    data: { tokenHash: randomUUID(), userId, expiresAt },
  });
}
