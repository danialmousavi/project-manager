
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncProjectProgressCache } from "@/lib/project-progress";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import {
  encodeAssignmentEvent,
} from "@/lib/task-assignment-history";
import {
  encodeTaskChangeEvent,
  type TaskFieldChange,
  type TaskFieldName,
} from "@/lib/task-change-history";
import {
  notifyTaskAssigned,
  notifyTaskStatusChanged,
} from "@/lib/task-notifications";

type Context = {
  params: Promise<{ id: string }>;
};

const statusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
]);

const priorityEnum = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

const taskTypeEnum = z.enum(["STORY", "TASK", "BUG"]);

const statusSchema = z.object({
  status: statusEnum,
}).strict();

const assignmentSchema = z.object({
  assigneeId: z.uuid().nullable(),
  note: z.string().trim().max(500).default(""),
}).strict();

const detailsSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000),
  priority: priorityEnum,
  type: taskTypeEnum.optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  rank: z.number().finite().min(0).max(100_000).optional(),
  acceptanceCriteria: z.string().trim().max(5000).nullable().optional(),
  epicId: z.uuid().nullable().optional(),
  milestoneId: z.uuid().nullable().optional(),
  parentTaskId: z.uuid().nullable().optional(),
  status: statusEnum,
  startDate: z.iso.date().nullable(),
  dueDate: z.iso.date().nullable(),
  assigneeId: z.uuid().nullable(),
  note: z.string().trim().max(500).default(""),
}).strict();

type TaskDetails = z.infer<typeof detailsSchema>;

function validOrigin(request: NextRequest) {
  return isAllowedOrigin(request);
}

function dateString(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? null;
}

function toDate(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

function taskError(error: unknown) {
  const code =
    error instanceof Error ? error.message : "";

  const errors: Record<
    string,
    { message: string; status: number }
  > = {
    NOT_FOUND: {
      message: "تسک پیدا نشد.",
      status: 404,
    },
    FORBIDDEN: {
      message: "اجازه انجام این عملیات را ندارید.",
      status: 403,
    },
    INVALID_ASSIGNEE: {
      message:
        "مسئول باید مدیر یا کارمند فعال و مجاز همین پروژه باشد.",
      status: 400,
    },
    CONFLICT: {
      message:
        "تسک هم‌زمان تغییر کرده است؛ صفحه را تازه کنید.",
      status: 409,
    },
    INVALID_EPIC: { message: "Epic باید متعلق به همین پروژه باشد.", status: 400 },
    INVALID_MILESTONE: { message: "مایلستون باید متعلق به همین پروژه باشد.", status: 400 },
    INVALID_PARENT_TASK: { message: "تسک والد معتبر نیست.", status: 400 },
  };

  if (errors[code]) {
    return NextResponse.json(
      { message: errors[code].message },
      { status: errors[code].status }
    );
  }

  console.error("Task API error:", error);

  return NextResponse.json(
    { message: "خطا در انجام عملیات تسک." },
    { status: 500 }
  );
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "شناسه تسک نامعتبر است." }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, projectId: true, assigneeId: true },
  });
  if (!task) return NextResponse.json({ message: "تسک پیدا نشد." }, { status: 404 });

  const access = await getTaskProjectAccess(actor, task.projectId);
  if (!access) {
    return NextResponse.json({ message: "اجازه مشاهده تسک را ندارید." }, { status: 403 });
  }

  const detail = await prisma.task.findFirstOrThrow({
    where: { id, deletedAt: null },
    select: {
      id: true, title: true, description: true, type: true, storyPoints: true,
      rank: true, acceptanceCriteria: true, priority: true, status: true,
      epic: { select: { id: true, name: true } },
      milestone: { select: { id: true, title: true } },
      dependencies: {
        where: { prerequisiteTask: { deletedAt: null } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          prerequisiteTask: {
            select: {
              id: true, title: true, status: true, type: true,
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      },
      parentTask: { select: { id: true, title: true, type: true } },
      subtasks: {
        where: { deletedAt: null },
        orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, type: true, status: true, storyPoints: true, assigneeId: true },
      },
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      sprint: { select: { id: true, name: true, status: true } },
      startDate: true, dueDate: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    task: {
      ...detail,
      dependencies: detail.dependencies.map((dependency) => ({
        id: dependency.id,
        task: dependency.prerequisiteTask,
        isBlocking: dependency.prerequisiteTask.status !== "DONE",
      })),
      startDate: detail.startDate?.toISOString() ?? null,
      dueDate: detail.dueDate?.toISOString() ?? null,
      createdAt: detail.createdAt.toISOString(),
      updatedAt: detail.updatedAt.toISOString(),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید." },
      { status: 401 }
    );
  }

  if (!validOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 }
    );
  }

  const body: unknown = await request
    .json()
    .catch(() => null);

  const currentTask = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      assigneeId: true,
    },
  });

  if (!currentTask) {
    return NextResponse.json(
      { message: "تسک پیدا نشد." },
      { status: 404 }
    );
  }

  const access = await getTaskProjectAccess(
    actor,
    currentTask.projectId
  );

  if (!access) {
    return NextResponse.json(
      { message: "دسترسی غیرمجاز." },
      { status: 403 }
    );
  }

  // Simple status updates.
  const statusParsed = statusSchema.safeParse(body);

  if (statusParsed.success) {
    if (
      !access.canManage &&
      currentTask.assigneeId !== actor.id
    ) {
      return NextResponse.json(
        { message: "اجازه تغییر وضعیت ندارید." },
        { status: 403 }
      );
    }

    try {
      const statusChange = await prisma.$transaction(async (tx) => {
        const current = await tx.task.findFirst({
          where: { id, deletedAt: null },
          select: {
            title: true,
            status: true,
            version: true,
            assigneeId: true,
          },
        });

        if (!current) throw new Error("NOT_FOUND");

        if (
          !access.canManage &&
          current.assigneeId !== actor.id
        ) {
          throw new Error("FORBIDDEN");
        }

        if (current.status === statusParsed.data.status) {
          return null;
        }

        const result = await tx.task.updateMany({
          where: {
            id,
            version: current.version,
            deletedAt: null,
            ...(!access.canManage
              ? { assigneeId: actor.id }
              : {}),
          },
          data: {
            status: statusParsed.data.status,
            version: { increment: 1 },
          },
        });

        if (result.count !== 1) {
          throw new Error("CONFLICT");
        }

        await tx.taskComment.create({
          data: {
            taskId: id,
            authorId: actor.id,
            content: encodeTaskChangeEvent({
              changes: [{
                field: "status",
                from: current.status,
                to: statusParsed.data.status,
              }],
              note: "",
            }),
          },
        });

        await syncProjectProgressCache(
          tx,
          currentTask.projectId
        );

        return {
          assigneeId: current.assigneeId,
          taskTitle: current.title,
        };
      });

      if (statusChange?.assigneeId) {
        await notifyTaskStatusChanged({
          taskId: id,
          taskTitle: statusChange.taskTitle,
          projectId: currentTask.projectId,
          recipientId: statusChange.assigneeId,
          actorId: actor.id,
          status: statusParsed.data.status,
        });
      }

      return NextResponse.json({
        success: true,
        message: "وضعیت تسک ثبت شد.",
      });
    } catch (error) {
      return taskError(error);
    }
  }

  if (!access.canManage) {
    return NextResponse.json(
      { message: "اجازه ویرایش تسک ندارید." },
      { status: 403 }
    );
  }

  const assignmentParsed =
    assignmentSchema.safeParse(body);

  const detailsParsed =
    detailsSchema.safeParse(body);

  if (
    !assignmentParsed.success &&
    !detailsParsed.success
  ) {
    return NextResponse.json(
      { message: "اطلاعات ویرایش تسک معتبر نیست." },
      { status: 400 }
    );
  }

  const details: TaskDetails | null =
    detailsParsed.success
      ? detailsParsed.data
      : null;

  const nextAssigneeId = details
    ? details.assigneeId
    : assignmentParsed.success
      ? assignmentParsed.data.assigneeId
      : null;

  const note = details
    ? details.note
    : assignmentParsed.success
      ? assignmentParsed.data.note
      : "";

  if (
    details?.startDate &&
    details.dueDate &&
    details.startDate > details.dueDate
  ) {
    return NextResponse.json(
      { message: "تاریخ پایان قبل از شروع است." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.task.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            projectId: true,
            version: true,
            title: true,
            description: true,
            type: true,
            storyPoints: true,
            rank: true,
            acceptanceCriteria: true,
            epicId: true,
            milestoneId: true,
            parentTaskId: true,
            priority: true,
            status: true,
            startDate: true,
            dueDate: true,
            sprintId: true,
            assigneeId: true,
            assignee: {
              select: { name: true },
            },
            _count: { select: { subtasks: { where: { deletedAt: null } } } },
          },
        });

        if (!current) throw new Error("NOT_FOUND");

        const assigneeChanged =
          current.assigneeId !== nextAssigneeId;

        let nextAssigneeName =
          current.assignee?.name ?? null;

        if (assigneeChanged && nextAssigneeId) {
          const member =
            await tx.projectMember.findFirst({
              where: {
                projectId: current.projectId,
                userId: nextAssigneeId,
                user: {
                  isActive: true,
                },
                ...(actor.role === "ADMIN"
                  ? {}
                  : { role: "MEMBER" }),
              },
              select: {
                role: true,
                user: {
                  select: {
                    name: true,
                    role: true,
                  },
                },
              },
            });

          const allowed =
            member &&
            (
              (member.role === "MANAGER" &&
                member.user.role === "MANAGER") ||
              (member.role === "MEMBER" &&
                member.user.role === "EMPLOYEE")
            );

          if (!allowed) {
            throw new Error("INVALID_ASSIGNEE");
          }

          nextAssigneeName = member.user.name;
        }

        if (assigneeChanged && !nextAssigneeId) {
          nextAssigneeName = null;
        }

        const changes: TaskFieldChange[] = [];
        const nextType = details?.type ?? current.type;
        const nextStoryPoints = details?.storyPoints === undefined
          ? current.storyPoints
          : details.storyPoints;
        const nextRank = details?.rank ?? current.rank;
        const nextAcceptanceCriteria = details?.acceptanceCriteria === undefined
          ? current.acceptanceCriteria
          : details.acceptanceCriteria || null;
        const nextEpicId = details?.epicId === undefined
          ? current.epicId
          : details.epicId;
        const nextMilestoneId = details?.milestoneId === undefined
          ? current.milestoneId
          : details.milestoneId;
        const nextParentTaskId = details?.parentTaskId === undefined
          ? current.parentTaskId
          : details.parentTaskId;

        if (nextEpicId) {
          const epic = await tx.epic.findFirst({ where: { id: nextEpicId, projectId: current.projectId }, select: { id: true } });
          if (!epic) throw new Error("INVALID_EPIC");
        }

        if (nextMilestoneId) {
          const milestone = await tx.milestone.findFirst({
            where: { id: nextMilestoneId, projectId: current.projectId },
            select: { id: true },
          });
          if (!milestone) throw new Error("INVALID_MILESTONE");
        }

        if (nextParentTaskId) {
          const parent = await tx.task.findFirst({
            where: {
              id: nextParentTaskId,
              projectId: current.projectId,
              deletedAt: null,
              parentTaskId: null,
              NOT: { id: current.id },
            },
            select: { id: true },
          });
          if (!parent || current._count.subtasks > 0) {
            throw new Error("INVALID_PARENT_TASK");
          }
        }

        if (details) {
          const before: Record<
            TaskFieldName,
            string | null
          > = {
            title: current.title,
            description: current.description,
            type: current.type,
            storyPoints: current.storyPoints === null ? null : String(current.storyPoints),
            rank: String(current.rank),
            acceptanceCriteria: current.acceptanceCriteria,
            epicId: current.epicId,
            milestoneId: current.milestoneId,
            parentTaskId: current.parentTaskId,
            priority: current.priority,
            status: current.status,
            startDate: dateString(current.startDate),
            dueDate: dateString(current.dueDate),
            sprintId: current.sprintId,
          };

          const after: Record<
            TaskFieldName,
            string | null
          > = {
            title: details.title,
            description: details.description || null,
            type: nextType,
            storyPoints: nextStoryPoints === null ? null : String(nextStoryPoints),
            rank: String(nextRank),
            acceptanceCriteria: nextAcceptanceCriteria,
            epicId: nextEpicId,
            milestoneId: nextMilestoneId,
            parentTaskId: nextParentTaskId,
            priority: details.priority,
            status: details.status,
            startDate: details.startDate,
            dueDate: details.dueDate,
            sprintId: current.sprintId,
          };

          for (const field of Object.keys(
            after
          ) as TaskFieldName[]) {
            if (before[field] !== after[field]) {
              changes.push({
                field,
                from: before[field],
                to: after[field],
              });
            }
          }
        }

        if (
          changes.length === 0 &&
          !assigneeChanged
        ) {
          return {
            changed: false,
            assigneeChanged: false,
            statusChanged: false,
          };
        }

        const updated = await tx.task.updateMany({
          where: {
            id,
            version: current.version,
            deletedAt: null,
          },
          data: {
            ...(details
              ? {
                  title: details.title,
                  description:
                    details.description || null,
                  type: nextType,
                  storyPoints: nextStoryPoints,
                  rank: nextRank,
                  acceptanceCriteria: nextAcceptanceCriteria,
                  epicId: nextEpicId,
                  milestoneId: nextMilestoneId,
                  parentTaskId: nextParentTaskId,
                  status: details.status,
                  priority: details.priority,
                  startDate: toDate(details.startDate),
                  dueDate: toDate(details.dueDate),
                }
              : {}),
            assigneeId: nextAssigneeId,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new Error("CONFLICT");
        }

        if (changes.length > 0) {
          await tx.taskComment.create({
            data: {
              taskId: id,
              authorId: actor.id,
              content: encodeTaskChangeEvent({
                changes,
                note,
              }),
            },
          });
        }

        if (assigneeChanged) {
          await tx.taskComment.create({
            data: {
              taskId: id,
              authorId: actor.id,
              content: encodeAssignmentEvent({
                fromUserId: current.assigneeId,
                fromUserName:
                  current.assignee?.name ?? null,
                toUserId: nextAssigneeId,
                toUserName: nextAssigneeName,
                note,
              }),
            },
          });
        }

        if (
          details &&
          current.status !== details.status
        ) {
          await syncProjectProgressCache(
            tx,
            current.projectId
          );
        }

        return {
          changed: true,
          assigneeChanged,
          statusChanged: Boolean(details && current.status !== details.status),
          projectId: current.projectId,
          taskTitle: current.title,
          assigneeId: nextAssigneeId,
        };
      }
    );

    if (result.changed && result.assigneeChanged && result.assigneeId) {
      await notifyTaskAssigned({
        taskId: id,
        taskTitle: result.taskTitle,
        projectId: result.projectId,
        recipientId: result.assigneeId,
        actorId: actor.id,
      });
    }

    if (result.changed && result.statusChanged && !result.assigneeChanged && result.assigneeId) {
      await notifyTaskStatusChanged({
        taskId: id,
        taskTitle: result.taskTitle,
        projectId: result.projectId,
        recipientId: result.assigneeId,
        actorId: actor.id,
        status: details?.status ?? "TODO",
      });
    }

    return NextResponse.json({
      success: true,
      changed: result.changed,
      message: result.changed
        ? "تغییرات تسک ذخیره شد."
        : "اطلاعات تسک تغییری نکرد.",
    });
  } catch (error) {
    return taskError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید." },
      { status: 401 }
    );
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json(
      { message: "فقط مدیر اصلی می‌تواند تسک را حذف کند." },
      { status: 403 }
    );
  }

  if (!validOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 }
    );
  }

  try {
    const deleted = await prisma.$transaction(
      async (tx) => {
        const task = await tx.task.findFirst({
          where: {
            id,
            project: { archivedAt: null },
            deletedAt: null,
          },
          select: { id: true, projectId: true },
        });

        if (!task) return false;

        await tx.task.update({
          where: { id: task.id },
          data: {
            deletedAt: new Date(),
            deletedById: actor.id,
            version: { increment: 1 },
          },
        });

        await syncProjectProgressCache(
          tx,
          task.projectId
        );

        return true;
      }
    );

    return NextResponse.json(
      {
        success: deleted,
        message: deleted
          ? "تسک حذف شد."
          : "تسک یافت نشد.",
      },
      { status: deleted ? 200 : 404 }
    );
  } catch (error) {
    console.error("Delete task error:", error);

    return NextResponse.json(
      { message: "خطا در حذف تسک." },
      { status: 500 }
    );
  }
}
