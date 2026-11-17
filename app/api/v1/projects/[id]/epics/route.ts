import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = { params: Promise<{ id: string }> };
const uuid = z.uuid();
const createSchema = z.object({
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).nullable().optional().default(null),
}).strict();

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

export async function GET(_request: NextRequest, context: Context) {
  const { actor, projectId, access } = await accessFor(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access) return fail("اجازه مشاهده پروژه ندارید.", 403);

  const epics = await prisma.epic.findMany({
    where: {
      projectId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      tasks: {
        where: {
          deletedAt: null,
        },
        orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
        take: 200,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          storyPoints: true,
          parentTaskId: true,
          _count: { select: { subtasks: { where: { deletedAt: null } } } },
        },
      },
      _count: {
        select: {
          tasks: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    canManage: access.canManage,
    actorId: actor.id,
    epics: epics.map((epic) => ({
      ...epic,
      createdAt: epic.createdAt.toISOString(),
      updatedAt: epic.updatedAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const { actor, projectId, access } = await accessFor(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!projectId) return fail("شناسه پروژه معتبر نیست.", 400);
  if (!access?.canManage) return fail("اجازه ایجاد Epic ندارید.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("اطلاعات Epic معتبر نیست.", 400);

  const epic = await prisma.epic.create({
    data: { ...parsed.data, description: parsed.data.description || null, projectId, createdById: actor.id },
    select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({
    success: true,
    epic: { ...epic, createdAt: epic.createdAt.toISOString(), updatedAt: epic.updatedAt.toISOString() },
    message: "Epic ایجاد شد.",
  }, { status: 201 });
}
