import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

import {
  ASSIGNMENT_PREFIX,
  decodeAssignmentEvent,
} from "@/lib/task-assignment-history";

import {
  TASK_CHANGE_PREFIX,
  decodeTaskChangeEvent,
  type TaskFieldChange,
} from "@/lib/task-change-history";

type Context = {
  params: Promise<{ id: string }>;
};

type HistoryItem = {
  id: string;
  type: "ASSIGNMENT" | "EDIT";
  fromUserName: string | null;
  toUserName: string | null;
  note: string;
  changes: TaskFieldChange[];
  createdAt: string;
  changedBy: {
    name: string;
  };
};

export async function GET(_request: NextRequest, context: Context) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه تسک نامعتبر است." },
      { status: 400 },
    );
  }

  const task = await prisma.task.findUnique({
    where: {
      id,
    },
    select: {
      projectId: true,
    },
  });

  if (!task) {
    return NextResponse.json({ message: "تسک یافت نشد." }, { status: 404 });
  }

  const access = await getTaskProjectAccess(actor, task.projectId);

  if (!access?.canManage) {
    return NextResponse.json(
      { message: "اجازه مشاهده تاریخچه را ندارید." },
      { status: 403 },
    );
  }

  const events = await prisma.taskComment.findMany({
    where: {
      taskId: id,
      OR: [
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
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    take: 150,
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

  const history: HistoryItem[] = events.flatMap<HistoryItem>((event) => {
    const base = {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      changedBy: {
        name: event.author.name,
      },
    };

    if (event.content.startsWith(ASSIGNMENT_PREFIX)) {
      const parsed = decodeAssignmentEvent(event.content);

      if (!parsed) {
        return [];
      }

      return [
        {
          ...base,
          type: "ASSIGNMENT",
          fromUserName: parsed.fromUserName,
          toUserName: parsed.toUserName,
          note: parsed.note,
          changes: [],
        },
      ];
    }

    if (event.content.startsWith(TASK_CHANGE_PREFIX)) {
      const parsed = decodeTaskChangeEvent(event.content);

      if (!parsed) {
        return [];
      }

      return [
        {
          ...base,
          type: "EDIT",
          fromUserName: null,
          toUserName: null,
          note: parsed.note,
          changes: parsed.changes,
        },
      ];
    }

    return [];
  });

  return NextResponse.json(
    {
      success: true,
      history,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
