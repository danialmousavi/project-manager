
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = {
  params: Promise<{ id: string }>;
};

const createTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000),
    priority: z.enum([
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ]),
    status: z.enum([
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
    ]),
    assigneeId: z.uuid().nullable(),
    startDate: z.iso.date().nullable(),
    dueDate: z.iso.date().nullable(),
  })
  .strict();

function toDate(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  assigneeId: true,
  assignee: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      comments: true,
    },
  },
} as const;

function serializeTask(task: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string;
  } | null;
  _count: {
    comments: number;
  };
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
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
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

  if (!access) {
    return NextResponse.json(
      { message: "دسترسی به پروژه مجاز نیست" },
      { status: 403 }
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: id,
      ...(access.canManage
        ? {}
        : { assigneeId: actor.id }),
    },
    select: taskSelect,
    orderBy: [
      { position: "asc" },
      { createdAt: "desc" },
    ],
    take: 200,
  });

  return NextResponse.json(
    {
      success: true,
      tasks: tasks.map(serializeTask),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
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

  const access = await getTaskProjectAccess(actor, id);

  if (!access?.canManage) {
    return NextResponse.json(
      { message: "اجازه ایجاد تسک ندارید" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ||
          "اطلاعات تسک نامعتبر است",
      },
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
      { message: "تاریخ پایان قبل از تاریخ شروع است" },
      { status: 400 }
    );
  }

  try {
    if (data.assigneeId) {
      const membership =
        await prisma.projectMember.findFirst({
          where: {
            projectId: id,
            userId: data.assigneeId,
            role: "MEMBER",
            user: {
              isActive: true,
              role: "EMPLOYEE",
            },
          },
          select: { id: true },
        });

      if (!membership) {
        return NextResponse.json(
          {
            message:
              "مسئول تسک باید یکی از کارمندان فعال پروژه باشد",
          },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        startDate: toDate(data.startDate),
        dueDate: toDate(data.dueDate),
        projectId: id,
        createdById: actor.id,
        assigneeId: data.assigneeId,
      },
      select: taskSelect,
    });

    return NextResponse.json(
      {
        success: true,
        message: "تسک با موفقیت ایجاد شد",
        task: serializeTask(task),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create task failed:", error);

    return NextResponse.json(
      { message: "خطا در ایجاد تسک" },
      { status: 500 }
    );
  }
}
