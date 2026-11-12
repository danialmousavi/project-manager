
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import { isProjectController } from "@/lib/role-access";

type Context = {
  params: Promise<{ id: string }>;
};

const uuid = z.uuid();

const sprintStatus = z.enum([
  "FUTURE",
  "ACTIVE",
  "COMPLETED",
]);

const createSchema = z.object({
  name: z.string().trim().min(3).max(150),
  goal: z.string().trim().max(2000).nullable().optional().default(null),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).strict();

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_STATUS"),
    sprintId: uuid,
    status: sprintStatus,
  }).strict(),

  z.object({
    action: z.literal("START"),
    sprintId: uuid,
  }).strict(),

  z.object({
    action: z.literal("UPDATE_SPRINT"),
    sprintId: uuid,
    name: z.string().trim().min(3).max(150),
    goal: z.string().trim().max(2000).nullable(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }).strict(),

  z.object({
    action: z.literal("ASSIGN_TASK"),
    sprintId: uuid,
    taskId: uuid,
  }).strict(),

  z.object({
    action: z.literal("REMOVE_TASK"),
    sprintId: uuid,
    taskId: uuid,
  }).strict(),

  z.object({
    action: z.literal("UPDATE_DATES"),
    sprintId: uuid,
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    expectedStartDate: z.iso.date(),
    expectedEndDate: z.iso.date(),
  }).strict(),
]);

const deleteSchema = z.object({
  sprintId: uuid,
}).strict();

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function asIso(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function validOrigin(request: NextRequest) {
  return isAllowedOrigin(request);
}

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

async function projectAccess(context: Context) {
  const actor = await getCurrentUser();

  if (!actor) {
    return {
      actor: null,
      projectId: null,
      access: null,
    };
  }

  const { id } = await context.params;

  if (!uuid.safeParse(id).success) {
    return {
      actor,
      projectId: null,
      access: null,
    };
  }

  return {
    actor,
    projectId: id,
    access: await getTaskProjectAccess(actor, id),
  };
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await projectAccess(context);

  if (!actor) {
    return fail("ابتدا وارد حساب شوید.", 401);
  }

  if (!projectId) {
    return fail("شناسه پروژه نامعتبر است.", 400);
  }

  if (!access) {
    return fail("اجازه مشاهده پروژه ندارید.", 403);
  }

  try {
    const [sprints, tasks] = await Promise.all([
      prisma.sprint.findMany({
        where: { projectId },
        orderBy: { startDate: "asc" },
        take: 100,
        select: {
          id: true,
          name: true,
          goal: true,
          status: true,
          startDate: true,
          endDate: true,
          startSnapshot: {
            select: {
              startedAt: true,
              plannedTaskCount: true,
              plannedStoryPoints: true,
            },
          },
        },
      }),

      prisma.task.findMany({
        where: {
          projectId,
          deletedAt: null,
          ...(access.canManage || isProjectController(actor.role)
            ? {}
            : { assigneeId: actor.id }),
        },
        orderBy: [
          { position: "asc" },
          { createdAt: "desc" },
        ],
        take: 500,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          storyPoints: true,
          rank: true,
          acceptanceCriteria: true,
          status: true,
          priority: true,
          startDate: true,
          dueDate: true,
          sprintId: true,
          assigneeId: true,
          assignee: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        canManage: access.canManage,
        canDelete: actor.role === "ADMIN",
        sprints: sprints.map((sprint) => ({
          ...sprint,
          startDate: asIso(sprint.startDate),
          endDate: asIso(sprint.endDate),
        })),
        tasks: tasks.map((task) => ({
          ...task,
          startDate: asIso(task.startDate),
          dueDate: asIso(task.dueDate),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GET sprints:", error);
    return fail("خطا در دریافت زمان‌بندی‌ها.", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await projectAccess(context);

  if (!actor) {
    return fail("ابتدا وارد حساب شوید.", 401);
  }

  if (!projectId) {
    return fail("شناسه پروژه نامعتبر است.", 400);
  }

  if (!access?.canManage) {
    return fail("اجازه ساخت اسپرینت ندارید.", 403);
  }

  if (!validOrigin(request)) {
    return fail("درخواست نامعتبر است.", 403);
  }

  const parsed = createSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return fail("اطلاعات اسپرینت معتبر نیست.", 400);
  }

  const data = parsed.data;

  if (data.startDate > data.endDate) {
    return fail("تاریخ پایان قبل از شروع است.", 400);
  }

  try {
    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name: data.name,
        goal: data.goal,
        status: "FUTURE",
        startDate: asDate(data.startDate),
        endDate: asDate(data.endDate),
      },
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        sprint: {
          ...sprint,
          startDate: asIso(sprint.startDate),
          endDate: asIso(sprint.endDate),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST sprint:", error);
    return fail("خطا در ساخت اسپرینت.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await projectAccess(context);

  if (!actor) {
    return fail("ابتدا وارد حساب شوید.", 401);
  }

  if (!projectId) {
    return fail("شناسه پروژه نامعتبر است.", 400);
  }

  if (!access?.canManage) {
    return fail("اجازه ویرایش اسپرینت ندارید.", 403);
  }

  if (!validOrigin(request)) {
    return fail("درخواست نامعتبر است.", 403);
  }

  const parsed = updateSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return fail("اطلاعات درخواست نامعتبر است.", 400);
  }

  const data = parsed.data;

  try {
    if (data.action === "UPDATE_DATES") {
      if (data.startDate > data.endDate) {
        return fail("تاریخ پایان قبل از شروع است.", 400);
      }

      const updated = await prisma.sprint.updateMany({
        where: {
          id: data.sprintId,
          projectId,
          startDate: asDate(data.expectedStartDate),
          endDate: asDate(data.expectedEndDate),
        },
        data: {
          startDate: asDate(data.startDate),
          endDate: asDate(data.endDate),
        },
      });

      if (updated.count !== 1) {
        return fail(
          "اسپرینت تغییر کرده است؛ صفحه را تازه کنید.",
          409
        );
      }

      return NextResponse.json({
        success: true,
        message: "تاریخ‌های اسپرینت ذخیره شدند.",
      });
    }

    if (data.action === "UPDATE_SPRINT") {
      if (data.startDate > data.endDate) {
        return fail("تاریخ پایان قبل از شروع است.", 400);
      }

      const updated = await prisma.sprint.updateMany({
        where: {
          id: data.sprintId,
          projectId,
          status: "FUTURE",
        },
        data: {
          name: data.name,
          goal: data.goal,
          startDate: asDate(data.startDate),
          endDate: asDate(data.endDate),
        },
      });

      if (updated.count !== 1) {
        return fail("فقط اسپرینت آینده قابل ویرایش است.", 409);
      }

      return NextResponse.json({
        success: true,
        message: "اطلاعات اسپرینت ذخیره شد.",
      });
    }

    const sprint = await prisma.sprint.findFirst({
      where: {
        id: data.sprintId,
        projectId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!sprint) {
      return fail("اسپرینت پیدا نشد.", 404);
    }

    if (data.action === "START") {
      if (sprint.status !== "FUTURE") {
        return fail("فقط اسپرینت آینده قابل شروع است.", 409);
      }

      const result = await prisma.$transaction(async (tx) => {
        const activeSprint = await tx.sprint.findFirst({
          where: { projectId, status: "ACTIVE" },
          select: { id: true },
        });

        if (activeSprint) {
          return { kind: "ACTIVE_EXISTS" as const };
        }

        const current = await tx.sprint.findFirst({
          where: {
            id: sprint.id,
            projectId,
            status: "FUTURE",
            startDate: { not: null },
            endDate: { not: null },
          },
          select: { id: true },
        });

        if (!current) {
          return { kind: "NOT_STARTABLE" as const };
        }

        const tasks = await tx.task.findMany({
          where: {
            projectId,
            sprintId: current.id,
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            type: true,
            storyPoints: true,
            rank: true,
            status: true,
            assigneeId: true,
          },
        });

        const snapshot = await tx.sprintStartSnapshot.create({
          data: {
            sprintId: current.id,
            plannedTaskCount: tasks.length,
            plannedStoryPoints: tasks.reduce(
              (total, task) => total + (task.storyPoints ?? 0),
              0
            ),
            tasks: {
              create: tasks.map((task) => ({
                taskId: task.id,
                title: task.title,
                type: task.type,
                storyPoints: task.storyPoints,
                rank: task.rank,
                statusAtStart: task.status,
                assigneeId: task.assigneeId,
              })),
            },
          },
          select: {
            startedAt: true,
            plannedTaskCount: true,
            plannedStoryPoints: true,
          },
        });

        await tx.sprint.update({
          where: { id: current.id },
          data: { status: "ACTIVE" },
        });

        return { kind: "STARTED" as const, snapshot };
      });

      if (result.kind === "ACTIVE_EXISTS") {
        return fail("یک اسپرینت فعال دیگر در این پروژه وجود دارد.", 409);
      }

      if (result.kind === "NOT_STARTABLE") {
        return fail("اسپرینت برای شروع معتبر نیست.", 409);
      }

      return NextResponse.json({
        success: true,
        message: "اسپرینت شروع شد.",
        snapshot: {
          ...result.snapshot,
          startedAt: result.snapshot.startedAt.toISOString(),
        },
      });
    }

    if (data.action === "SET_STATUS") {
      if (data.status === "ACTIVE") {
        return fail("برای شروع اسپرینت از عملیات START استفاده کنید.", 400);
      }

      await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: data.status },
      });

      return NextResponse.json({
        success: true,
        message: "وضعیت اسپرینت تغییر کرد.",
      });
    }

    if (
      sprint.status === "COMPLETED" ||
      sprint.status === "CANCELLED"
    ) {
      return fail(
        "امکان تغییر تسک‌های اسپرینت بسته وجود ندارد.",
        409
      );
    }

    if (data.action === "ASSIGN_TASK") {
      const updated = await prisma.task.updateMany({
        where: {
          id: data.taskId,
          projectId,
          deletedAt: null,
          OR: [
            { sprintId: null },
            { sprintId: data.sprintId },
          ],
        },
        data: {
          sprintId: data.sprintId,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        return fail(
          "تسک وجود ندارد یا عضو اسپرینت دیگری است.",
          409
        );
      }

      return NextResponse.json({
        success: true,
        message: "تسک به اسپرینت اضافه شد.",
      });
    }

    const removed = await prisma.task.updateMany({
      where: {
        id: data.taskId,
        projectId,
        deletedAt: null,
        sprintId: data.sprintId,
      },
      data: {
        sprintId: null,
        version: { increment: 1 },
      },
    });

    if (removed.count !== 1) {
      return fail(
        "تسک در این اسپرینت پیدا نشد.",
        404
      );
    }

    return NextResponse.json({
      success: true,
      message: "تسک از اسپرینت خارج شد.",
    });
  } catch (error) {
    console.error("PATCH sprint:", error);
    return fail("خطا در ذخیره تغییرات.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await projectAccess(context);

  if (!actor) {
    return fail("ابتدا وارد حساب شوید.", 401);
  }

  if (!projectId) {
    return fail("شناسه پروژه نامعتبر است.", 400);
  }

  if (
    actor.role !== "ADMIN" ||
    !access?.canManage
  ) {
    return fail(
      "فقط مدیر اصلی می‌تواند اسپرینت را حذف کند.",
      403
    );
  }

  if (!validOrigin(request)) {
    return fail("درخواست نامعتبر است.", 403);
  }

  const parsed = deleteSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return fail("شناسه اسپرینت نامعتبر است.", 400);
  }

  try {
    const deleted = await prisma.$transaction(
      async (tx) => {
        const sprint = await tx.sprint.findFirst({
          where: {
            id: parsed.data.sprintId,
            projectId,
          },
          select: { id: true },
        });

        if (!sprint) {
          return false;
        }

        await tx.task.updateMany({
          where: {
            projectId,
            sprintId: sprint.id,
            deletedAt: null,
          },
          data: {
            sprintId: null,
            version: { increment: 1 },
          },
        });

        await tx.sprint.delete({
          where: { id: sprint.id },
        });

        return true;
      }
    );

    return NextResponse.json(
      {
        success: deleted,
        message: deleted
          ? "اسپرینت حذف شد؛ تسک‌ها باقی ماندند."
          : "اسپرینت پیدا نشد.",
      },
      { status: deleted ? 200 : 404 }
    );
  } catch (error) {
    console.error("DELETE sprint:", error);
    return fail("خطا در حذف اسپرینت.", 500);
  }
}
