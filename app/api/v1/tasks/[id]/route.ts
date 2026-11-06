
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = {
  params: Promise<{ id: string }>;
};

const updateStatusSchema = z
  .object({
    status: z.enum([
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
    ]),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  if (
    !request.headers.get("origin") ||
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه تسک نامعتبر است" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "وضعیت انتخاب‌شده نامعتبر است" },
      { status: 400 }
    );
  }

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
      { message: "تسک پیدا نشد" },
      { status: 404 }
    );
  }

  const access = await getTaskProjectAccess(
    actor,
    task.projectId
  );

  if (
    !access ||
    (!access.canManage && task.assigneeId !== actor.id)
  ) {
    return NextResponse.json(
      { message: "اجازه تغییر وضعیت این تسک را ندارید" },
      { status: 403 }
    );
  }

  try {
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
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: "تسک تغییر کرده است؛ دوباره تلاش کنید" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "وضعیت تسک به‌روزرسانی شد",
    });
  } catch (error) {
    console.error("Update task status failed:", error);

    return NextResponse.json(
      { message: "خطا در تغییر وضعیت تسک" },
      { status: 500 }
    );
  }
}
