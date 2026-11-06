
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import {
  encodeAssignmentEvent,
} from "@/lib/task-assignment-history";
import {
  encodeTaskChangeEvent,
  type TaskFieldChange,
  type TaskFieldName,
} from "@/lib/task-change-history";

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
  status: statusEnum,
  startDate: z.iso.date().nullable(),
  dueDate: z.iso.date().nullable(),
  assigneeId: z.uuid().nullable(),
  note: z.string().trim().max(500).default(""),
}).strict();

type TaskDetails = z.infer<typeof detailsSchema>;

function validOrigin(request: NextRequest) {
  return (
    request.headers.get("origin") ===
    request.nextUrl.origin
  );
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

  const currentTask = await prisma.task.findUnique({
    where: { id },
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
      await prisma.$transaction(async (tx) => {
        const current = await tx.task.findUnique({
          where: { id },
          select: {
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
          return;
        }

        const result = await tx.task.updateMany({
          where: {
            id,
            version: current.version,
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
      });

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
    const changed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.task.findUnique({
          where: { id },
          select: {
            id: true,
            projectId: true,
            version: true,
            title: true,
            description: true,
            priority: true,
            status: true,
            startDate: true,
            dueDate: true,
            assigneeId: true,
            assignee: {
              select: { name: true },
            },
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

        if (details) {
          const before: Record<
            TaskFieldName,
            string | null
          > = {
            title: current.title,
            description: current.description,
            priority: current.priority,
            status: current.status,
            startDate: dateString(current.startDate),
            dueDate: dateString(current.dueDate),
          };

          const after: Record<
            TaskFieldName,
            string | null
          > = {
            title: details.title,
            description: details.description || null,
            priority: details.priority,
            status: details.status,
            startDate: details.startDate,
            dueDate: details.dueDate,
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
          return false;
        }

        const updated = await tx.task.updateMany({
          where: {
            id,
            version: current.version,
          },
          data: {
            ...(details
              ? {
                  title: details.title,
                  description:
                    details.description || null,
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

        return true;
      }
    );

    return NextResponse.json({
      success: true,
      changed,
      message: changed
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
          },
          select: { id: true },
        });

        if (!task) return false;

        await tx.taskComment.deleteMany({
          where: { taskId: id },
        });

        await tx.task.delete({
          where: { id },
        });

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
