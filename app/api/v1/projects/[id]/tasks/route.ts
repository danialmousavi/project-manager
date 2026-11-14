
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncProjectProgressCache } from "@/lib/project-progress";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import { isProjectController } from "@/lib/role-access";
import {
  encodeAssignmentEvent,
} from "@/lib/task-assignment-history";

type Context = {
  params: Promise<{ id: string }>;
};

const taskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000),
  type: z.enum(["STORY", "TASK", "BUG"]).optional().default("TASK"),
  storyPoints: z.number().int().min(0).max(100).nullable().optional().default(null),
  rank: z.number().finite().min(0).max(100_000).optional().default(0),
  acceptanceCriteria: z.string().trim().max(5000).nullable().optional().default(null),
  epicId: z.uuid().nullable().optional().default(null),
  parentTaskId: z.uuid().nullable().optional().default(null),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum([
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
  ]),
  assigneeId: z.uuid().nullable(),
  startDate: z.iso.date().nullable(),
  dueDate: z.iso.date().nullable(),
}).strict();

function toDate(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

const taskSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  storyPoints: true,
  rank: true,
  acceptanceCriteria: true,
  epicId: true,
  parentTaskId: true,
  sprintId: true,
  epic: { select: { id: true, name: true } },
  parentTask: { select: { id: true, title: true, type: true } },
  sprint: { select: { id: true, name: true, status: true } },
  _count: { select: { subtasks: { where: { deletedAt: null } }, comments: true } },
  status: true,
  priority: true,
  assigneeId: true,
  assignee: {
    select: {
      id: true,
      name: true,
    },
  },
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeTask(task: {
  id: string;
  title: string;
  description: string | null;
  type: string;
  storyPoints: number | null;
  rank: number;
  acceptanceCriteria: string | null;
  epicId: string | null;
  parentTaskId: string | null;
  sprintId: string | null;
  epic: { id: string; name: string } | null;
  parentTask: { id: string; title: string; type: string } | null;
  sprint: { id: string; name: string; status: string } | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { comments: number; subtasks: number };
}) {
  return {
    ...task,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه پروژه معتبر نیست." },
      { status: 400 }
    );
  }

  const access = await getTaskProjectAccess(actor, id);

  if (!access) {
    return NextResponse.json(
      { message: "دسترسی به پروژه مجاز نیست." },
      { status: 403 }
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: id,
      deletedAt: null,
      ...(access.canManage || isProjectController(actor.role)
        ? {}
        : { assigneeId: actor.id }),
    },
    orderBy: [
      { position: "asc" },
      { createdAt: "desc" },
    ],
    take: 200,
    select: taskSelect,
  });

  return NextResponse.json(
    {
      success: true,
      tasks: tasks.map((task) => ({
        ...serializeTask(task),
        _count: { comments: task._count.comments, subtasks: task._count.subtasks },
      })),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(
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
      { message: "شناسه پروژه معتبر نیست." },
      { status: 400 }
    );
  }

  const access = await getTaskProjectAccess(actor, id);

  if (!access?.canManage) {
    return NextResponse.json(
      { message: "اجازه ایجاد تسک ندارید." },
      { status: 403 }
    );
  }

  const parsed = taskSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات تسک نامعتبر است." },
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
      { message: "تاریخ پایان قبل از شروع است." },
      { status: 400 }
    );
  }

  try {
    const task = await prisma.$transaction(async (tx) => {
      if (data.epicId) {
        const epic = await tx.epic.findFirst({ where: { id: data.epicId, projectId: id }, select: { id: true } });
        if (!epic) throw new Error("INVALID_EPIC");
      }

      if (data.parentTaskId) {
        const parent = await tx.task.findFirst({
          where: { id: data.parentTaskId, projectId: id, deletedAt: null, parentTaskId: null },
          select: { id: true },
        });
        if (!parent) throw new Error("INVALID_PARENT_TASK");
      }

      let assigneeName: string | null = null;

      if (data.assigneeId) {
        const member =
          await tx.projectMember.findFirst({
            where: {
              projectId: id,
              userId: data.assigneeId,
              user: { isActive: true },
              ...(actor.role === "ADMIN"
                ? {}
                : { role: "MEMBER" }),
            },
            select: {
              role: true,
              user: {
                select: {
                  name: true,
                  role: true,
                },
              },
            },
          });

        const valid =
          member &&
          (
            (member.role === "MANAGER" &&
              member.user.role === "MANAGER") ||
            (member.role === "MEMBER" &&
              member.user.role === "EMPLOYEE")
          );

        if (!valid) {
          throw new Error("INVALID_ASSIGNEE");
        }

        assigneeName = member.user.name;
      }

      const created = await tx.task.create({
        data: {
          title: data.title,
          description: data.description || null,
          type: data.type,
          storyPoints: data.storyPoints,
          rank: data.rank,
          acceptanceCriteria: data.acceptanceCriteria || null,
          epicId: data.epicId,
          parentTaskId: data.parentTaskId,
          priority: data.priority,
          status: data.status,
          startDate: toDate(data.startDate),
          dueDate: toDate(data.dueDate),
          projectId: id,
          createdById: actor.id,
          assigneeId: data.assigneeId,
        },
        select: taskSelect,
      });

      if (data.assigneeId) {
        await tx.taskComment.create({
          data: {
            taskId: created.id,
            authorId: actor.id,
            content: encodeAssignmentEvent({
              fromUserId: null,
              fromUserName: null,
              toUserId: data.assigneeId,
              toUserName: assigneeName,
              note: "واگذاری اولیه تسک",
            }),
          },
        });
      }

      await syncProjectProgressCache(tx, id);

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        task: {
          ...serializeTask(task),
          _count: { comments: task._count.comments, subtasks: task._count.subtasks },
        },
        message: "تسک ایجاد شد.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_ASSIGNEE"
    ) {
      return NextResponse.json(
        {
          message:
            "مسئول باید مدیر یا کارمند فعال همین پروژه باشد.",
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "INVALID_EPIC") {
      return NextResponse.json({ message: "Epic باید متعلق به همین پروژه باشد." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "INVALID_PARENT_TASK") {
      return NextResponse.json({ message: "تسک والد باید یک آیتم سطح‌اولِ فعال از همین پروژه باشد." }, { status: 400 });
    }

    console.error("Create task:", error);

    return NextResponse.json(
      { message: "خطا در ایجاد تسک." },
      { status: 500 }
    );
  }
}
