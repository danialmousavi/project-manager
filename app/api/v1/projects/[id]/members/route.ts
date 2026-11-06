
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canEditProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ id: string }>;
};

const membersSchema = z
  .object({
    managerIds: z.array(z.uuid()).min(1).max(100),
    memberIds: z.array(z.uuid()).max(500),
  })
  .strict();

export async function PUT(
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
      { message: "شناسه پروژه نامعتبر است" },
      { status: 400 }
    );
  }

  if (!(await canEditProject(actor, id))) {
    return NextResponse.json(
      { message: "اجازه مدیریت اعضای پروژه را ندارید" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = membersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "فهرست اعضای انتخاب‌شده معتبر نیست" },
      { status: 400 }
    );
  }

  const managerIds = [...new Set(parsed.data.managerIds)];
  const memberIds = [...new Set(parsed.data.memberIds)];

  if (memberIds.some((userId) => managerIds.includes(userId))) {
    return NextResponse.json(
      { message: "یک کاربر نمی‌تواند هم‌زمان دو نقش عضویت داشته باشد" },
      { status: 400 }
    );
  }

  const allIds = [...managerIds, ...memberIds];

  try {
    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: {
          id: { in: allIds },
          isActive: true,
        },
        select: {
          id: true,
          role: true,
        },
      });

      const roles = new Map(
        users.map((user) => [user.id, user.role])
      );

      const validManagers = managerIds.every(
        (userId) => roles.get(userId) === "MANAGER"
      );

      const validMembers = memberIds.every(
        (userId) => roles.get(userId) === "EMPLOYEE"
      );

      if (
        users.length !== allIds.length ||
        !validManagers ||
        !validMembers
      ) {
        throw new Error("INVALID_MEMBERS");
      }

      // Recheck access within the transaction.
      const project = await tx.project.findFirst({
        where: {
          id,
          archivedAt: null,
          ...(actor.role === "ADMIN"
            ? {}
            : {
                members: {
                  some: {
                    userId: actor.id,
                    role: "MANAGER",
                  },
                },
              }),
        },
        select: { id: true },
      });

      if (!project) {
        throw new Error("ACCESS_DENIED");
      }

      await tx.projectMember.deleteMany({
        where: { projectId: id },
      });

      await tx.projectMember.createMany({
        data: [
          ...managerIds.map((userId) => ({
            projectId: id,
            userId,
            role: "MANAGER" as const,
          })),
          ...memberIds.map((userId) => ({
            projectId: id,
            userId,
            role: "MEMBER" as const,
          })),
        ],
      });
    });

    return NextResponse.json({
      success: true,
      message: "اعضای پروژه با موفقیت ذخیره شدند",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_MEMBERS"
    ) {
      return NextResponse.json(
        { message: "مدیران یا کارمندان انتخاب‌شده معتبر نیستند" },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "ACCESS_DENIED"
    ) {
      return NextResponse.json(
        { message: "دسترسی به پروژه مجاز نیست" },
        { status: 403 }
      );
    }

    console.error("Update project members failed:", error);

    return NextResponse.json(
      { message: "خطا در ذخیره اعضای پروژه" },
      { status: 500 }
    );
  }
}
