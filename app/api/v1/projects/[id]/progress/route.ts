import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncProjectProgressCache } from "@/lib/project-progress";
import { isAllowedOrigin } from "@/lib/security/origin";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = {
  params: Promise<{ id: string }>;
};

const progressSchema = z
  .object({
    // Legacy clients may still send this value. It is validated but ignored.
    progress: z.number().int().min(0).max(100).optional(),
    note: z.string().trim().max(1000),
  })
  .strict();

export async function POST(
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

  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه پروژه نامعتبر است" },
      { status: 400 }
    );
  }

  const access = await getTaskProjectAccess(actor, id);

  if (!access?.canChangeStatus) {
    return NextResponse.json(
      { message: "اجازه ثبت پیشرفت ندارید" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = progressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات پیشرفت نامعتبر است" },
      { status: 400 }
    );
  }

  try {
    const progress = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          id,
          archivedAt: null,
        },
        select: { id: true },
      });

      if (!project) {
        throw new Error("ACCESS_DENIED");
      }

      const calculated = await syncProjectProgressCache(tx, id);

      await tx.progressHistory.create({
        data: {
          target: "PROJECT",
          projectId: id,
          progress: calculated,
          note: parsed.data.note || null,
          updatedById: actor.id,
        },
      });

      return calculated;
    });

    return NextResponse.json({
      success: true,
      progress,
      message: "پیشرفت پروژه براساس تسک‌ها محاسبه شد",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ACCESS_DENIED"
    ) {
      return NextResponse.json(
        { message: "دسترسی به پروژه مجاز نیست" },
        { status: 403 }
      );
    }

    console.error("Project progress update failed:", error);

    return NextResponse.json(
      { message: "خطا در محاسبه پیشرفت" },
      { status: 500 }
    );
  }
}
