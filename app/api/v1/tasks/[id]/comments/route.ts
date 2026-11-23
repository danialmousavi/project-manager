
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import type { AppRole } from "@/lib/role-access";
import { notifyTaskCommented } from "@/lib/task-notifications";

import {
  ASSIGNMENT_PREFIX,
} from "@/lib/task-assignment-history";

import {
  TASK_CHANGE_PREFIX,
} from "@/lib/task-change-history";

type Context = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict();

async function accessibleTask(
  actor: {
    id: string;
    role: AppRole;
  },
  id: string
) {
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
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

  return {
    task,
    isProjectController: access.isProjectController,
    canComment: !access.isProjectController && (access.canManage || task.assigneeId === actor.id),
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
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 }
    );
  }

  const permitted = await accessibleTask(actor, id);
  if (!permitted) {
    return NextResponse.json(
      { message: "دسترسی مجاز نیست." },
      { status: 403 }
    );
  }

  const comments = await prisma.taskComment.findMany({
    where: {
      taskId: id,
      NOT: [
        {
          content: {
            startsWith: ASSIGNMENT_PREFIX,
          },
        },
        {
          content: {
            startsWith: TASK_CHANGE_PREFIX,
          },
        },
      ],
    },
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
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 }
    );
  }

  const permitted = await accessibleTask(actor, id);
  if (permitted?.isProjectController) {
    return NextResponse.json(
      { message: "ناظر کنترل پروژه فقط دسترسی مشاهده دارد." },
      { status: 403 }
    );
  }
  if (!permitted?.canComment) {
    return NextResponse.json(
      { message: "اجازه ثبت کامنت ندارید." },
      { status: 403 }
    );
  }

  const { task } = permitted;

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
    parsed.data.content.startsWith(ASSIGNMENT_PREFIX) ||
    parsed.data.content.startsWith(TASK_CHANGE_PREFIX)
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

    if (task.assigneeId) {
      await notifyTaskCommented({
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        recipientId: task.assigneeId,
        actorId: actor.id,
        commentId: comment.id,
        authorName: comment.author.name,
        content: comment.content,
      });
    }

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
    console.error("Create task comment:", error);

    return NextResponse.json(
      { message: "خطا در ثبت کامنت." },
      { status: 500 }
    );
  }
}
