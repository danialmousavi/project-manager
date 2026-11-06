
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = {
  params: Promise<{ id: string }>;
};

const uuid = z.uuid();

const sprintStatus = z.enum([
  "PLANNED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

const createSchema = z.object({
  name: z.string().trim().min(3).max(150),
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
    action: z.literal("ASSIGN_TASK"),
    sprintId: uuid,
    taskId: uuid,
  }).strict(),

  z.object({
    action: z.literal("REMOVE_TASK"),
    sprintId: uuid,
    taskId: uuid,
  }).strict(),
]);

const deleteSchema = z.object({
  sprintId: uuid,
}).strict();

function dateOf(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function hasValidOrigin(request: NextRequest) {
  return request.headers.get("origin") ===
    request.nextUrl.origin;
}

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

async function getContextAccess(context: Context) {
  const actor = await getCurrentUser();
  if (!actor) {
    return { actor: null, projectId: null, access: null };
  }

  const { id } = await context.params;
  if (!uuid.safeParse(id).success) {
    return { actor, projectId: null, access: null };
  }

  const access = await getTaskProjectAccess(actor, id);
  return { actor, projectId: id, access };
}

// GET: Read sprints and their project tasks.
export async function GET(
  _request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await getContextAccess(context);

  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه نامعتبر است.", 400);
  if (!access) return fail("دسترسی مجاز نیست.", 403);

  try {
    const [sprints, tasks] = await Promise.all([
      prisma.sprint.findMany({
        where: { projectId },
        orderBy: { startDate: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      }),

      prisma.task.findMany({
        where: {
          projectId,
          ...(access.canManage
            ? {}
            : { assigneeId: actor.id }),
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          sprintId: true,
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
          startDate: sprint.startDate?.toISOString() ?? null,
          endDate: sprint.endDate?.toISOString() ?? null,
        })),
        tasks,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Get sprints:", error);
    return fail("خطا در دریافت اسپرینت‌ها.", 500);
  }
}

// POST: Create a new sprint.
export async function POST(
  request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await getContextAccess(context);

  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه نامعتبر است.", 400);
  if (!access?.canManage) {
    return fail("اجازه ایجاد اسپرینت ندارید.", 403);
  }
  if (!hasValidOrigin(request)) {
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
        status: "PLANNED",
        startDate: dateOf(data.startDate),
        endDate: dateOf(data.endDate),
      },
      select: {
        id: true,
        name: true,
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
          startDate: sprint.startDate?.toISOString() ?? null,
          endDate: sprint.endDate?.toISOString() ?? null,
        },
        message: "اسپرینت ساخته شد.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create sprint:", error);
    return fail("خطا در ساخت اسپرینت.", 500);
  }
}

// PATCH: Change status or manage sprint tasks.
export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await getContextAccess(context);

  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه نامعتبر است.", 400);
  if (!access?.canManage) {
    return fail("اجازه ویرایش اسپرینت ندارید.", 403);
  }
  if (!hasValidOrigin(request)) {
    return fail("درخواست نامعتبر است.", 403);
  }

  const parsed = updateSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return fail("اطلاعات درخواست معتبر نیست.", 400);
  }

  const data = parsed.data;

  try {
    const sprint = await prisma.sprint.findFirst({
      where: {
        id: data.sprintId,
        projectId,
      },
      select: { id: true, status: true },
    });

    if (!sprint) {
      return fail("اسپرینت پیدا نشد.", 404);
    }

    if (data.action === "SET_STATUS") {
      const updated = await prisma.sprint.updateMany({
        where: {
          id: sprint.id,
          projectId,
        },
        data: { status: data.status },
      });

      if (updated.count !== 1) {
        return fail("اسپرینت تغییر کرده است.", 409);
      }

      return NextResponse.json({
        success: true,
        message: "وضعیت اسپرینت ذخیره شد.",
      });
    }

    if (
      sprint.status === "COMPLETED" ||
      sprint.status === "CANCELLED"
    ) {
      return fail(
        "برای تغییر تسک‌ها، اسپرینت نباید بسته باشد.",
        409
      );
    }

    if (data.action === "ASSIGN_TASK") {
      const updated = await prisma.task.updateMany({
        where: {
          id: data.taskId,
          projectId,
          // Task must not belong to another sprint.
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
          "این تسک وجود ندارد یا عضو اسپرینت دیگری است.",
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
        sprintId: data.sprintId,
      },
      data: {
        sprintId: null,
        version: { increment: 1 },
      },
    });

    if (removed.count !== 1) {
      return fail("تسک در این اسپرینت پیدا نشد.", 404);
    }

    return NextResponse.json({
      success: true,
      message: "تسک از اسپرینت خارج شد.",
    });
  } catch (error) {
    console.error("Update sprint:", error);
    return fail("خطا در ذخیره تغییرات اسپرینت.", 500);
  }
}

// DELETE: Only Admin may delete a sprint.
export async function DELETE(
  request: NextRequest,
  context: Context
) {
  const { actor, projectId, access } =
    await getContextAccess(context);

  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه نامعتبر است.", 400);
  if (actor.role !== "ADMIN" || !access?.canManage) {
    return fail("فقط مدیر اصلی می‌تواند اسپرینت را حذف کند.", 403);
  }
  if (!hasValidOrigin(request)) {
    return fail("درخواست نامعتبر است.", 403);
  }

  const parsed = deleteSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return fail("شناسه اسپرینت معتبر نیست.", 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.findFirst({
        where: {
          id: parsed.data.sprintId,
          projectId,
        },
        select: { id: true },
      });

      if (!sprint) return false;

      // Keep tasks; only remove their sprint relation.
      await tx.task.updateMany({
        where: {
          projectId,
          sprintId: sprint.id,
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
    });

    return NextResponse.json(
      {
        success: result,
        message: result
          ? "اسپرینت حذف شد؛ تسک‌های آن حفظ شدند."
          : "اسپرینت یافت نشد.",
      },
      { status: result ? 200 : 404 }
    );
  } catch (error) {
    console.error("Delete sprint:", error);
    return fail("خطا در حذف اسپرینت.", 500);
  }
}
