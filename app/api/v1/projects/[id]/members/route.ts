
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";
import { notifyProjectMembersAdded } from "@/lib/project-notifications";

type Context = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  managerIds: z.array(z.uuid()).max(100),
  memberIds: z.array(z.uuid()).max(500),
  controllerIds: z.array(z.uuid()).max(100).optional(),
}).strict();

export async function PUT(
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

  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه پروژه نامعتبر است." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات اعضا معتبر نیست." },
      { status: 400 }
    );
  }

  const managerIds = [...new Set(parsed.data.managerIds)];
  const memberIds = [...new Set(parsed.data.memberIds)];
  const requestedControllerIds = parsed.data.controllerIds === undefined
    ? null
    : [...new Set(parsed.data.controllerIds)];

  if (
    memberIds.some((id) => managerIds.includes(id)) ||
    requestedControllerIds?.some((id) =>
      managerIds.includes(id) || memberIds.includes(id)
    )
  ) {
    return NextResponse.json(
      { message: "نقش عضویت تکراری است." },
      { status: 400 }
    );
  }

  try {
    const membershipChange = await prisma.$transaction(
      async (tx) => {
        const project = await tx.project.findFirst({
          where: { id, archivedAt: null },
          select: {
            name: true,
            members: {
              select: {
                userId: true,
                role: true,
              },
            },
          },
        });

        if (!project) throw new Error("NOT_FOUND");

        const currentManagers = project.members
          .filter((member) => member.role === "MANAGER")
          .map((member) => member.userId)
          .sort();
        const currentControllers = project.members
          .filter((member) => member.role === "CONTROLLER")
          .map((member) => member.userId)
          .sort();
        const controllerIds = requestedControllerIds ?? currentControllers;

        if (actor.role !== "ADMIN") {
          const allowed =
            actor.role === "MANAGER" &&
            currentManagers.includes(actor.id);

          if (!allowed) throw new Error("FORBIDDEN");

          if (
            JSON.stringify([...managerIds].sort()) !==
            JSON.stringify(currentManagers)
          ) {
            throw new Error("MANAGER_CHANGE_FORBIDDEN");
          }

          if (
            requestedControllerIds !== null &&
            JSON.stringify([...controllerIds].sort()) !==
            JSON.stringify(currentControllers)
          ) {
            throw new Error("CONTROLLER_CHANGE_FORBIDDEN");
          }
        }

        if (managerIds.length === 0) {
          throw new Error("NO_MANAGER");
        }

        const allIds = [...managerIds, ...memberIds, ...controllerIds];
        const previousMemberIds = project.members.map((member) => member.userId);

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

        const valid =
          users.length === allIds.length &&
          managerIds.every(
            (userId) => roles.get(userId) === "MANAGER"
          ) &&
          memberIds.every(
            (userId) => roles.get(userId) === "EMPLOYEE"
          ) &&
          controllerIds.every(
            (userId) => roles.get(userId) === "CONTROLLER"
          );

        if (!valid) throw new Error("INVALID_MEMBERS");

        const assignedTasks = await tx.task.count({
          where: {
            projectId: id,
            deletedAt: null,
            assigneeId: {
              not: null,
              notIn: allIds,
            },
          },
        });

        if (assignedTasks > 0) {
          throw new Error("ASSIGNED_TASKS");
        }

        await tx.projectMember.deleteMany({
          where: {
            projectId: id,
            ...(actor.role === "ADMIN"
              ? {}
              : { role: "MEMBER" }),
          },
        });

        await tx.projectMember.createMany({
          data: [
            ...(actor.role === "ADMIN"
              ? managerIds.map((userId) => ({
                  projectId: id,
                  userId,
                  role: "MANAGER" as const,
                }))
              : []),
            ...memberIds.map((userId) => ({
              projectId: id,
              userId,
              role: "MEMBER" as const,
            })),
            ...(actor.role === "ADMIN"
              ? controllerIds.map((userId) => ({
                  projectId: id,
                  userId,
                  role: "CONTROLLER" as const,
                }))
              : []),
          ],
        });

        return {
          projectName: project.name,
          addedUserIds: allIds.filter((userId) => !previousMemberIds.includes(userId)),
        };
      },
      { isolationLevel: "Serializable" }
    );

    if (membershipChange.addedUserIds.length > 0) {
      await notifyProjectMembersAdded({
        projectId: id,
        projectName: membershipChange.projectName,
        recipientIds: membershipChange.addedUserIds,
        actorId: actor.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "اعضای پروژه ذخیره شدند.",
    });
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "";

    const messages: Record<string, string> = {
      NOT_FOUND: "پروژه یافت نشد.",
      FORBIDDEN: "اجازه مدیریت اعضای پروژه را ندارید.",
      MANAGER_CHANGE_FORBIDDEN:
        "فقط مدیر اصلی می‌تواند مدیران پروژه را تغییر دهد.",
      CONTROLLER_CHANGE_FORBIDDEN:
        "فقط مدیر اصلی می‌تواند ناظران کنترل پروژه را تغییر دهد.",
      NO_MANAGER: "حداقل یک مدیر پروژه الزامی است.",
      INVALID_MEMBERS:
        "کاربران انتخاب‌شده معتبر نیستند.",
      ASSIGNED_TASKS:
        "ابتدا تسک‌های اعضایی را که می‌خواهید حذف کنید، به فرد دیگری واگذار کنید.",
    };

    return NextResponse.json(
      {
        message:
          messages[code] ||
          "خطا در ذخیره اعضا؛ دوباره تلاش کنید.",
      },
      {
        status:
          code === "FORBIDDEN" ||
          code === "MANAGER_CHANGE_FORBIDDEN" ||
          code === "CONTROLLER_CHANGE_FORBIDDEN"
            ? 403
            : code === "NOT_FOUND"
              ? 404
              : code
                ? 400
                : 409,
      }
    );
  }
}
