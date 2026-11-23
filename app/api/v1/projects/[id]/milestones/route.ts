import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = { params: Promise<{ id: string }> };

const uuid = z.uuid();
const milestoneStatus = z.enum(["PLANNED", "COMPLETED"]);

const milestoneFields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).nullable().optional().default(null),
  targetDate: z.iso.date(),
  status: milestoneStatus.optional().default("PLANNED"),
  completedAt: z.iso.date().nullable().optional(),
};

const createSchema = z.object(milestoneFields).strict();

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_MILESTONE"),
    milestoneId: uuid,
    ...milestoneFields,
  }).strict(),
  z.object({
    action: z.literal("SET_STATUS"),
    milestoneId: uuid,
    status: milestoneStatus,
    completedAt: z.iso.date().nullable().optional(),
  }).strict(),
]);

const deleteSchema = z.object({ milestoneId: uuid }).strict();

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function asIsoDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function displayStatus(milestone: {
  status: "PLANNED" | "COMPLETED";
  targetDate: Date;
}) {
  if (milestone.status === "COMPLETED") return "COMPLETED" as const;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (milestone.targetDate < today) return "OVERDUE" as const;

  const dueSoonBoundary = new Date(today);
  dueSoonBoundary.setDate(dueSoonBoundary.getDate() + 7);
  if (milestone.targetDate <= dueSoonBoundary) return "DUE_SOON" as const;

  return "PLANNED" as const;
}

async function projectAccess(context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return { actor: null, projectId: null, access: null };

  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return { actor, projectId: null, access: null };

  return {
    actor,
    projectId: id,
    access: await getTaskProjectAccess(actor, id),
  };
}

function milestoneData({
  status,
  completedAt,
}: {
  status: "PLANNED" | "COMPLETED";
  completedAt?: string | null;
}) {
  return {
    status,
    completedAt: status === "COMPLETED"
      ? asDate(completedAt ?? new Date().toISOString().slice(0, 10))
      : null,
  };
}

export async function GET(_request: NextRequest, context: Context) {
  const { actor, projectId, access } = await projectAccess(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access) return fail("اجازه مشاهده پروژه را ندارید.", 403);

  const canViewAll = access.canViewAllTasks;
  const visibleTaskFilter = {
    deletedAt: null,
    ...(canViewAll ? {} : { assigneeId: actor.id }),
  };

  const milestones = await prisma.milestone.findMany({
    where: {
      projectId,
      ...(canViewAll ? {} : { tasks: { some: visibleTaskFilter } }),
    },
    orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      targetDate: true,
      completedAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const taskCounts = milestones.length === 0
    ? []
    : await prisma.task.groupBy({
        by: ["milestoneId", "status"],
        where: {
          projectId,
          milestoneId: { in: milestones.map((milestone) => milestone.id) },
          ...visibleTaskFilter,
        },
        _count: { _all: true },
      });

  const progressByMilestone = new Map<string, { totalTasks: number; completedTasks: number }>();
  for (const count of taskCounts) {
    if (!count.milestoneId) continue;
    const progress = progressByMilestone.get(count.milestoneId) ?? { totalTasks: 0, completedTasks: 0 };
    progress.totalTasks += count._count._all;
    if (count.status === "DONE") progress.completedTasks += count._count._all;
    progressByMilestone.set(count.milestoneId, progress);
  }

  return NextResponse.json({
    success: true,
    canManage: access.canManage,
    milestones: milestones.map((milestone) => {
      const { totalTasks, completedTasks } = progressByMilestone.get(milestone.id) ?? {
        totalTasks: 0,
        completedTasks: 0,
      };

      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        targetDate: asIsoDate(milestone.targetDate),
        completedAt: asIsoDate(milestone.completedAt),
        status: milestone.status,
        displayStatus: displayStatus(milestone),
        totalTasks,
        completedTasks,
        progress: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
        createdAt: milestone.createdAt.toISOString(),
        updatedAt: milestone.updatedAt.toISOString(),
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const { actor, projectId, access } = await projectAccess(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access?.canManage) return fail("اجازه ایجاد مایلستون ندارید.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("اطلاعات مایلستون معتبر نیست.", 400);

  const milestone = await prisma.milestone.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      targetDate: asDate(parsed.data.targetDate),
      projectId,
      ...milestoneData(parsed.data),
    },
    select: { id: true, title: true, description: true, targetDate: true, completedAt: true, status: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({
    success: true,
    milestone: {
      ...milestone,
      targetDate: asIsoDate(milestone.targetDate),
      completedAt: asIsoDate(milestone.completedAt),
      displayStatus: displayStatus(milestone),
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
      totalTasks: 0,
      completedTasks: 0,
      progress: 0,
    },
    message: "مایلستون ایجاد شد.",
  }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { actor, projectId, access } = await projectAccess(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access?.canManage) return fail("اجازه ویرایش مایلستون ندارید.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("اطلاعات مایلستون معتبر نیست.", 400);

  const existing = await prisma.milestone.findFirst({
    where: { id: parsed.data.milestoneId, projectId },
    select: { id: true },
  });
  if (!existing) return fail("مایلستون در این پروژه یافت نشد.", 404);

  const data = parsed.data.action === "UPDATE_MILESTONE"
    ? {
        title: parsed.data.title,
        description: parsed.data.description || null,
        targetDate: asDate(parsed.data.targetDate),
        ...milestoneData(parsed.data),
      }
    : milestoneData(parsed.data);

  const milestone = await prisma.milestone.update({
    where: { id: existing.id },
    data,
    select: { id: true, title: true, description: true, targetDate: true, completedAt: true, status: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({
    success: true,
    milestone: {
      ...milestone,
      targetDate: asIsoDate(milestone.targetDate),
      completedAt: asIsoDate(milestone.completedAt),
      displayStatus: displayStatus(milestone),
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
    },
    message: "مایلستون به‌روزرسانی شد.",
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  const { actor, projectId, access } = await projectAccess(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access?.canManage) return fail("اجازه حذف مایلستون ندارید.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("شناسه مایلستون معتبر نیست.", 400);

  const result = await prisma.milestone.deleteMany({
    where: { id: parsed.data.milestoneId, projectId },
  });
  if (result.count !== 1) return fail("مایلستون در این پروژه یافت نشد.", 404);

  return NextResponse.json({ success: true, message: "مایلستون حذف شد." });
}
