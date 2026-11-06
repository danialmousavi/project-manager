
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createProjectSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    description: z.string().trim().max(3000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    managerIds: z.array(z.uuid()).min(1),
    memberIds: z.array(z.uuid()),
  })
  .strict();

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { message: "فقط مدیر اصلی می‌تواند پروژه بسازد" },
      { status: 403 }
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

  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          "نام پروژه، اولویت یا اعضای انتخاب‌شده معتبر نیستند",
      },
      { status: 400 }
    );
  }

  const { name, description, priority, managerIds, memberIds } =
    parsed.data;

  const uniqueManagers = [...new Set(managerIds)];
  const uniqueMembers = [...new Set(memberIds)].filter(
    (id) => !uniqueManagers.includes(id)
  );

  const allIds = [...uniqueManagers, ...uniqueMembers];

  const users = await prisma.user.findMany({
    where: {
      id: { in: allIds },
      isActive: true,
    },
    select: {
      id: true,
      role: true,
    },
  });

  const roleById = new Map(
    users.map((user) => [user.id, user.role])
  );

  const managersAreValid = uniqueManagers.every(
    (id) => roleById.get(id) === "MANAGER"
  );

  const membersAreValid = uniqueMembers.every(
    (id) => roleById.get(id) === "EMPLOYEE"
  );

  if (
    users.length !== allIds.length ||
    !managersAreValid ||
    !membersAreValid
  ) {
    return NextResponse.json(
      {
        message:
          "مدیران باید نقش مدیر پروژه و اعضا باید نقش کارمند داشته باشند و فعال باشند",
      },
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        priority,
        status: "PLANNED",
        progress: 0,
        createdById: currentUser.id,

        members: {
          create: [
            ...uniqueManagers.map((userId) => ({
              userId,
              role: "MANAGER" as const,
            })),
            ...uniqueMembers.map((userId) => ({
              userId,
              role: "MEMBER" as const,
            })),
          ],
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "پروژه با موفقیت ساخته شد",
        project,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { message: "خطا در ایجاد پروژه" },
      { status: 500 }
    );
  }
}
