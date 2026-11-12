
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isProjectController } from "@/lib/role-access";

type Context = {
  params: Promise<{ id: string }>;
};

const MAX_TASKS = 1000;

export async function GET(
  _request: Request,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      {
        success: false,
        message: "ابتدا وارد حساب کاربری شوید.",
      },
      { status: 401 }
    );
  }

  const { id: projectId } = await context.params;

  if (!z.uuid().safeParse(projectId).success) {
    return NextResponse.json(
      {
        success: false,
        message: "شناسه پروژه نامعتبر است.",
      },
      { status: 400 }
    );
  }

  const access = await getTaskProjectAccess(
    actor,
    projectId
  );

  if (!access) {
    return NextResponse.json(
      {
        success: false,
        message: "اجازه مشاهده برد این پروژه را ندارید.",
      },
      { status: 403 }
    );
  }

  try {
    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    const taskWhere = {
      projectId,
      deletedAt: null,
      sprintId: activeSprint?.id ?? "__no_active_sprint__",
      ...(access.canManage || isProjectController(actor.role)
        ? {}
        : { assigneeId: actor.id }),
    };

    const [tasks, totalTasks] =
      await Promise.all([
        prisma.task.findMany({
          where: taskWhere,
          orderBy: [
            { position: "asc" },
            { createdAt: "desc" },
          ],
          take: MAX_TASKS,
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

        prisma.task.count({
          where: taskWhere,
        }),
      ]);

    return NextResponse.json(
      {
        success: true,
        projectId,
        canManage: access.canManage,
        tasks: tasks.map((task) => ({
          ...task,
          startDate:
            task.startDate?.toISOString() ?? null,
          dueDate:
            task.dueDate?.toISOString() ?? null,
        })),
        activeSprint: activeSprint && {
          ...activeSprint,
          startDate: activeSprint.startDate?.toISOString() ?? null,
          endDate: activeSprint.endDate?.toISOString() ?? null,
          remainingDays: activeSprint.endDate
            ? Math.ceil((activeSprint.endDate.getTime() - Date.now()) / 86_400_000)
            : null,
          completedTasks: tasks.filter((task) => task.status === "DONE").length,
          storyPoints: tasks.reduce((total, task) => total + (task.storyPoints ?? 0), 0),
        },
        sprints: activeSprint ? [{ id: activeSprint.id, name: activeSprint.name, status: activeSprint.status }] : [],
        totalTasks,
        truncated: totalTasks > MAX_TASKS,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Kanban GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "خطا در دریافت اطلاعات برد کانبان.",
      },
      { status: 500 }
    );
  }
}
