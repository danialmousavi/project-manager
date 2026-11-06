
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import {
  ASSIGNMENT_PREFIX,
  decodeAssignmentEvent,
} from "@/lib/task-assignment-history";

type Context = {
  params: Promise<{ id: string }>;
};

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
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 }
    );
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      projectId: true,
    },
  });

  if (!task) {
    return NextResponse.json(
      { message: "تسک یافت نشد." },
      { status: 404 }
    );
  }

  const access = await getTaskProjectAccess(
    actor,
    task.projectId
  );

  if (!access?.canManage) {
    return NextResponse.json(
      {
        message:
          "اجازه مشاهده تاریخچه واگذاری را ندارید.",
      },
      { status: 403 }
    );
  }

  const events = await prisma.taskComment.findMany({
    where: {
      taskId: id,
      content: {
        startsWith: ASSIGNMENT_PREFIX,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      success: true,
      history: events.flatMap((event) => {
        const parsed = decodeAssignmentEvent(
          event.content
        );

        if (!parsed) return [];

        return [{
          id: event.id,
          fromUserName: parsed.fromUserName,
          toUserName: parsed.toUserName,
          note: parsed.note,
          createdAt: event.createdAt.toISOString(),
          changedBy: event.author,
        }];
      }),
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
