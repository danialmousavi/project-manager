
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const schema = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().max(3000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  managerIds: z.array(z.uuid()).min(1).max(100),
  memberIds: z.array(z.uuid()).max(500),
  controllerIds: z.array(z.uuid()).max(100).optional(),
  startDate: z.iso.date().nullable(),
  dueDate: z.iso.date().nullable(),
}).strict();

function toDate(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید." },
      { status: 401 }
    );
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json(
      { message: "فقط مدیر اصلی می‌تواند پروژه ایجاد کند." },
      { status: 403 }
    );
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات واردشده معتبر نیست." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (
    data.startDate &&
    data.dueDate &&
    data.startDate > data.dueDate
  ) {
    return NextResponse.json(
      { message: "تاریخ پایان قبل از تاریخ شروع است." },
      { status: 400 }
    );
  }

  const managerIds = [...new Set(data.managerIds)];
  const memberIds = [...new Set(data.memberIds)];
  const controllerIds = [...new Set(data.controllerIds ?? [])];

  if (
    memberIds.some((id) => managerIds.includes(id)) ||
    controllerIds.some((id) => managerIds.includes(id) || memberIds.includes(id))
  ) {
    return NextResponse.json(
      { message: "یک نفر نمی‌تواند دو نقش عضویت داشته باشد." },
      { status: 400 }
    );
  }

  const ids = [...managerIds, ...memberIds, ...controllerIds];

  try {
    const companyMembership = await prisma.companyMember.findFirst({
      where: {
        userId: actor.id,
        isActive: true,
        company: { status: "ACTIVE" },
      },
      orderBy: { joinedAt: "asc" },
      select: { companyId: true },
    });

    if (!companyMembership) {
      return NextResponse.json(
        { message: "حساب مدیر اصلی به هیچ شرکت فعالی متصل نیست." },
        { status: 409 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: ids },
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

    const valid =
      users.length === ids.length &&
      managerIds.every(
        (id) => roles.get(id) === "MANAGER"
      ) &&
      memberIds.every(
        (id) => roles.get(id) === "EMPLOYEE"
      ) &&
      controllerIds.every(
        (id) => roles.get(id) === "CONTROLLER"
      );

    if (!valid) {
      return NextResponse.json(
        { message: "مدیران یا کارمندان انتخاب‌شده معتبر نیستند." },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description || null,
        priority: data.priority,
        status: "PLANNED",
        progress: 0,
        startDate: toDate(data.startDate),
        dueDate: toDate(data.dueDate),
        companyId: companyMembership.companyId,
        createdById: actor.id,
        members: {
          create: [
            ...managerIds.map((userId) => ({
              userId,
              role: "MANAGER" as const,
            })),
            ...memberIds.map((userId) => ({
              userId,
              role: "MEMBER" as const,
            })),
            ...controllerIds.map((userId) => ({
              userId,
              role: "CONTROLLER" as const,
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
        project,
        message: "پروژه ایجاد شد.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create project:", error);

    return NextResponse.json(
      { message: "خطا در ایجاد پروژه." },
      { status: 500 }
    );
  }
}
