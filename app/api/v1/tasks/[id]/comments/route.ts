
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import {
  ASSIGNMENT_PREFIX,
} from "@/lib/task-assignment-history";

type Context = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict();

async function accessibleTask(
  actor: {
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  },
  id: string
) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      assigneeId: true,
    },
  });

  if (!task) return null;

  const access = await getTaskProjectAccess(
    actor,
    task.projectId
  );

  if (
    !access ||
    (!access.canManage &&
      task.assigneeId !== actor.id)
  ) {
    return null;
  }

  return task;
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد شوید." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه نامعتبر است." },
      { status: 400 }
    );
  }

  if (!(await accessibleTask(actor, id))) {
    return NextResponse.json(
      { message: "دسترسی مجاز نیست." },
      { status: 403 }
    );
  }

  const comments = await prisma.taskComment.findMany({
    where: {
      taskId: id,
      NOT: {
        content: {
          startsWith: ASSIGNMENT_PREFIX,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 200,
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      success: true,
      comments: comments.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
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
      { message: "ابتدا وارد شوید." },
      { status: 401 }
    );
  }

  if (
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 }
    );
  }

  if (!(await accessibleTask(actor, id))) {
    return NextResponse.json(
      { message: "اجازه ثبت کامنت ندارید." },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "متن کامنت معتبر نیست." },
      { status: 400 }
    );
  }

  if (
    parsed.data.content.startsWith(ASSIGNMENT_PREFIX)
  ) {
    return NextResponse.json(
      { message: "متن کامنت معتبر نیست." },
      { status: 400 }
    );
  }

  try {
    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: actor.id,
        content: parsed.data.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        comment: {
          ...comment,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create comment:", error);

    return NextResponse.json(
      { message: "خطا در ثبت کامنت." },
      { status: 500 }
    );
  }
}
