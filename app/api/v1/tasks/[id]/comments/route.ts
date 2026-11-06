
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = {
  params: Promise<{ id: string }>;
};

const commentSchema = z
  .object({
    content: z.string().trim().min(1).max(2000),
  })
  .strict();

async function getAccessibleTask(
  actor: {
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  },
  taskId: string
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
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

  if (!access) return null;

  if (!access.canManage && task.assigneeId !== actor.id) {
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
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه تسک نامعتبر است" },
      { status: 400 }
    );
  }

  const task = await getAccessibleTask(actor, id);

  if (!task) {
    return NextResponse.json(
      { message: "تسک قابل مشاهده نیست" },
      { status: 403 }
    );
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
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
      comments: comments.map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
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
      { message: "شناسه تسک نامعتبر است" },
      { status: 400 }
    );
  }

  const task = await getAccessibleTask(actor, id);

  if (!task) {
    return NextResponse.json(
      { message: "اجازه ثبت کامنت ندارید" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "متن کامنت باید بین ۱ تا ۲۰۰۰ کاراکتر باشد" },
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
        message: "کامنت ثبت شد",
        comment: {
          ...comment,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create task comment failed:", error);

    return NextResponse.json(
      { message: "خطا در ثبت کامنت" },
      { status: 500 }
    );
  }
}
