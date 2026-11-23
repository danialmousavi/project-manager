
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canCreateCompanyProject, getCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const schema = z.object({
  companyId: z.uuid(),
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
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { status: true },
    });

    if (!company) {
      return NextResponse.json(
        { message: "شرکت انتخاب‌شده پیدا نشد." },
        { status: 404 }
      );
    }

    if (company.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "برای شرکت تعلیق‌شده نمی‌توان پروژه ایجاد کرد." },
        { status: 409 }
      );
    }

    const access = await getCompanyAccess(actor, data.companyId);

    if (!access || !canCreateCompanyProject(access)) {
      return NextResponse.json(
        { message: "اجازه ایجاد پروژه برای این شرکت را ندارید." },
        { status: 403 }
      );
    }

    const companyMembers = await prisma.companyMember.findMany({
      where: {
        isActive: true,
        companyId: data.companyId,
        userId: { in: ids },
        user: { isActive: true },
      },
      select: {
        role: true,
        userId: true,
      },
    });

    const roles = new Map(
      companyMembers.map((member) => [member.userId, member.role])
    );

    const valid =
      companyMembers.length === ids.length &&
      managerIds.every(
        (id) => roles.get(id) === "PROJECT_MANAGER"
      ) &&
      memberIds.every(
        (id) => roles.get(id) === "EXPERT"
      ) &&
      controllerIds.every(
        (id) => roles.get(id) === "CONTROLLER"
      );

    if (!valid) {
      return NextResponse.json(
        { message: "اعضای انتخاب‌شده باید نقش متناسب و عضویت فعال در همین شرکت داشته باشند." },
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
        companyId: data.companyId,
        createdById: actor.id,
        members: {
          create: [
            ...(!access.isPlatformAdmin && !managerIds.includes(actor.id)
              ? [{ userId: actor.id, role: "MANAGER" as const }]
              : []),
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
