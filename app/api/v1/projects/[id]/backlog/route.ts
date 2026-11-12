import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import { isProjectController } from "@/lib/role-access";
import { encodeTaskChangeEvent } from "@/lib/task-change-history";

type Context = { params: Promise<{ id: string }> };
const uuid = z.uuid();

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("MOVE_TASK"), taskId: uuid, sprintId: uuid.nullable() }).strict(),
  z.object({ action: z.literal("MOVE_AND_REORDER"), taskId: uuid, sprintId: uuid.nullable(), rank: z.number().finite().min(0).max(100_000) }).strict(),
  z.object({ action: z.literal("REORDER_TASK"), taskId: uuid, rank: z.number().finite().min(0).max(100_000) }).strict(),
]);

const taskSelect = {
  id: true, title: true, description: true, acceptanceCriteria: true, type: true, storyPoints: true, rank: true,
  priority: true, status: true, sprintId: true, assigneeId: true,
  epicId: true, parentTaskId: true,
  epic: { select: { id: true, name: true } },
  parentTask: { select: { id: true, title: true, type: true } },
  _count: { select: { subtasks: { where: { deletedAt: null } } } },
  assignee: { select: { id: true, name: true } },
} as const;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function accessFor(context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return { actor: null, projectId: null, access: null };
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return { actor, projectId: null, access: null };
  return { actor, projectId: id, access: await getTaskProjectAccess(actor, id) };
}

export async function GET(request: NextRequest, context: Context) {
  const { actor, projectId, access } = await accessFor(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access) return fail("اجازه مشاهده پروژه ندارید.", 403);

  const assigneeId = request.nextUrl.searchParams.get("assigneeId");
  const type = request.nextUrl.searchParams.get("type");
  const priority = request.nextUrl.searchParams.get("priority");
  const epicId = request.nextUrl.searchParams.get("epicId");
  if ((assigneeId && !uuid.safeParse(assigneeId).success) ||
      (epicId && !uuid.safeParse(epicId).success) ||
      (type && !["STORY", "TASK", "BUG"].includes(type)) ||
      (priority && !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority))) {
    return fail("فیلتر بک‌لاگ معتبر نیست.", 400);
  }

  const canViewAll = access.canManage || isProjectController(actor.role);
  if (!canViewAll && assigneeId && assigneeId !== actor.id) {
    return fail("اجازه مشاهده تسک‌های سایر کاربران را ندارید.", 403);
  }
  const where = {
    projectId,
    deletedAt: null,
    ...(canViewAll ? {} : { assigneeId: actor.id }),
    ...(assigneeId ? { assigneeId } : {}),
    ...(type ? { type: type as "STORY" | "TASK" | "BUG" } : {}),
    ...(priority ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" } : {}),
    ...(epicId ? { epicId } : {}),
  };

  const [sprints, tasks] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId, status: { in: ["ACTIVE", "FUTURE"] } },
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
      select: { id: true, name: true, goal: true, status: true, startDate: true, endDate: true },
    }),
    prisma.task.findMany({ where, orderBy: [{ rank: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: taskSelect }),
  ]);

  const serialise = (task: (typeof tasks)[number]) => task;
  const activeSprint = sprints.find((sprint) => sprint.status === "ACTIVE") ?? null;
  const futureSprints = sprints.filter((sprint) => sprint.status === "FUTURE");
  const backlog = tasks.filter((task) => task.sprintId === null && task.status !== "DONE");
  const tasksFor = (sprintId: string) => tasks.filter((task) => task.sprintId === sprintId).map(serialise);

  return NextResponse.json({
    success: true,
    canManage: access.canManage,
    activeSprint: activeSprint && { ...activeSprint, tasks: tasksFor(activeSprint.id), storyPoints: tasksFor(activeSprint.id).reduce((sum, task) => sum + (task.storyPoints ?? 0), 0) },
    futureSprints: futureSprints.map((sprint) => ({ ...sprint, tasks: tasksFor(sprint.id), storyPoints: tasksFor(sprint.id).reduce((sum, task) => sum + (task.storyPoints ?? 0), 0) })),
    backlog: backlog.map(serialise),
    backlogStoryPoints: backlog.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { actor, projectId, access } = await accessFor(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access?.canManage) return fail("اجازه مدیریت بک‌لاگ ندارید.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("اطلاعات درخواست معتبر نیست.", 400);
  const data = parsed.data;

  const task = await prisma.task.findFirst({ where: { id: data.taskId, projectId, deletedAt: null }, select: { id: true, sprintId: true, rank: true } });
  if (!task) return fail("تسک پیدا نشد.", 404);

  if (data.action === "REORDER_TASK") {
    await prisma.task.update({ where: { id: task.id }, data: { rank: data.rank, version: { increment: 1 } } });
    return NextResponse.json({ success: true, message: "ترتیب بک‌لاگ ذخیره شد." });
  }

  if (data.sprintId) {
    const sprint = await prisma.sprint.findFirst({ where: { id: data.sprintId, projectId, status: { in: ["ACTIVE", "FUTURE"] } }, select: { id: true, name: true } });
    if (!sprint) return fail("اسپرینت مقصد معتبر یا قابل برنامه‌ریزی نیست.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: task.id }, data: {
      sprintId: data.sprintId,
      ...(data.action === "MOVE_AND_REORDER" ? { rank: data.rank } : {}),
      version: { increment: 1 },
    } });
    await tx.taskComment.create({ data: {
      taskId: task.id,
      authorId: actor.id,
      content: encodeTaskChangeEvent({
        note: "جابجایی از بک‌لاگ",
        changes: [
          ...(task.sprintId !== data.sprintId ? [{ field: "sprintId" as const, from: task.sprintId, to: data.sprintId }] : []),
          ...(data.action === "MOVE_AND_REORDER" && task.rank !== data.rank ? [{ field: "rank" as const, from: String(task.rank), to: String(data.rank) }] : []),
        ],
      }),
    } });
  });

  return NextResponse.json({ success: true, message: data.sprintId ? "تسک به اسپرینت منتقل شد." : "تسک به بک‌لاگ بازگشت." });
}
