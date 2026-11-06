
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import {
  encodeAssignmentEvent,
} from "@/lib/task-assignment-history";

type Context = {
  params: Promise<{ id: string }>;
};

const statusSchema = z.object({
  status: z.enum([
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
  ]),
}).strict();

const assignmentSchema = z.object({
  assigneeId: z.uuid().nullable(),
  note: z.string().trim().max(500).default(""),
}).strict();

function validOrigin(request: NextRequest) {
  return (
    request.headers.get("origin") ===
    request.nextUrl.origin
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

  const body = await request.json().catch(() => null);

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      assigneeId: true,
    },
  });

  if (!task) {
    return NextResponse.json(
      { message: "تسک پیدا نشد." },
      { status: 404 }
    );
  }

  const access = await getTaskProjectAccess(
    actor,
    task.projectId
  );

  if (!access) {
    return NextResponse.json(
      { message: "دسترسی غیرمجاز." },
      { status: 403 }
    );
  }

  // Change task status.
  if (
    body &&
    typeof body === "object" &&
    Object.hasOwn(body, "status")
  ) {
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "وضعیت تسک نامعتبر است." },
        { status: 400 }
      );
    }

    if (
      !access.canManage &&
      task.assigneeId !== actor.id
    ) {
      return NextResponse.json(
        { message: "اجازه تغییر وضعیت این تسک را ندارید." },
        { status: 403 }
      );
    }

    const result = await prisma.task.updateMany({
      where: {
        id,
        projectId: task.projectId,
        ...(!access.canManage
          ? { assigneeId: actor.id }
          : {}),
      },
      data: {
        status: parsed.data.status,
        version: { increment: 1 },
      },
    });

    return NextResponse.json(
      {
        success: result.count === 1,
        message:
          result.count === 1
            ? "وضعیت تسک ذخیره شد."
            : "تسک تغییر کرده است؛ صفحه را تازه کنید.",
      },
      {
        status: result.count === 1 ? 200 : 409,
      }
    );
  }

  // Change task assignee.
  const parsed = assignmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات واگذاری نامعتبر است." },
      { status: 400 }
    );
  }

  if (!access.canManage) {
    return NextResponse.json(
      { message: "اجازه واگذاری تسک ندارید." },
      { status: 403 }
    );
  }

  try {
    const changed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.task.findUnique({
          where: { id },
          select: {
            assigneeId: true,
            assignee: {
              select: { name: true },
            },
            version: true,
          },
        });

        if (!current) {
          throw new Error("NOT_FOUND");
        }

        const nextId = parsed.data.assigneeId;

        if (current.assigneeId === nextId) {
          return false;
        }

        let nextName: string | null = null;

        if (nextId) {
          const member =
            await tx.projectMember.findFirst({
              where: {
                projectId: task.projectId,
                userId: nextId,
                user: { isActive: true },
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

          const valid =
            member &&
            (
              (member.role === "MANAGER" &&
                member.user.role === "MANAGER") ||
              (member.role === "MEMBER" &&
                member.user.role === "EMPLOYEE")
            );

          if (!valid) {
            throw new Error("INVALID_ASSIGNEE");
          }

          nextName = member.user.name;
        }

        const updated = await tx.task.updateMany({
          where: {
            id,
            version: current.version,
            assigneeId: current.assigneeId,
          },
          data: {
            assigneeId: nextId,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new Error("CONFLICT");
        }

        await tx.taskComment.create({
          data: {
            taskId: id,
            authorId: actor.id,
            content: encodeAssignmentEvent({
              fromUserId: current.assigneeId,
              fromUserName:
                current.assignee?.name ?? null,
              toUserId: nextId,
              toUserName: nextName,
              note: parsed.data.note,
            }),
          },
        });

        return true;
      }
    );

    return NextResponse.json({
      success: true,
      changed,
      message: changed
        ? "واگذاری تسک ثبت شد."
        : "مسئول تسک تغییری نکرد.",
    });
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "";

    if (code === "INVALID_ASSIGNEE") {
      return NextResponse.json(
        { message: "مسئول انتخاب‌شده معتبر نیست." },
        { status: 400 }
      );
    }

    if (code === "CONFLICT") {
      return NextResponse.json(
        {
          message:
            "مسئول تسک توسط فرد دیگری تغییر کرده؛ صفحه را تازه کنید.",
        },
        { status: 409 }
      );
    }

    console.error("Assign task:", error);

    return NextResponse.json(
      { message: "خطا در واگذاری تسک." },
      { status: 500 }
    );
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
      {
        message:
          "فقط مدیر اصلی می‌تواند تسک را حذف کند.",
      },
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
          : "تسک پیدا نشد.",
      },
      { status: deleted ? 200 : 404 }
    );
  } catch (error) {
    console.error("Delete task:", error);

    return NextResponse.json(
      { message: "خطا در حذف تسک." },
      { status: 500 }
    );
  }
}
