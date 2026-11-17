import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = { params: Promise<{ id: string }> };

const dependencySchema = z.object({ prerequisiteTaskId: z.uuid() }).strict();

async function accessibleTask(actor: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, projectId: true, assigneeId: true },
  });
  if (!task) return { task: null, access: null };

  const access = await getTaskProjectAccess(actor, task.projectId);
  if (!access) {
    return { task: null, access: null };
  }
  return { task, access };
}

function dependencyResponse(dependency: {
  id: string;
  prerequisiteTask: { id: string; title: string; status: string; type: string; assignee: { id: string; name: string } | null };
}) {
  const prerequisite = dependency.prerequisiteTask;
  return {
    id: dependency.id,
    task: prerequisite,
    isBlocking: prerequisite.status !== "DONE",
  };
}

export async function GET(_request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه تسک نامعتبر است." }, { status: 400 });

  const { task } = await accessibleTask(actor, id);
  if (!task) return NextResponse.json({ message: "اجازه مشاهده وابستگی‌های این تسک را ندارید." }, { status: 403 });

  const dependencies = await prisma.taskDependency.findMany({
    where: { dependentTaskId: id, prerequisiteTask: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prerequisiteTask: {
        select: {
          id: true, title: true, status: true, type: true,
          assignee: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    dependencies: dependencies.map(dependencyResponse),
    blocked: dependencies.some((dependency) => dependency.prerequisiteTask.status !== "DONE"),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });

  const { id } = await context.params;
  const parsed = dependencySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ message: "اطلاعات وابستگی معتبر نیست." }, { status: 400 });
  if (id === parsed.data.prerequisiteTaskId) return NextResponse.json({ message: "یک تسک نمی‌تواند به خودش وابسته باشد." }, { status: 400 });

  const { task, access } = await accessibleTask(actor, id);
  if (!task || !access?.canManage) return NextResponse.json({ message: "اجازه مدیریت وابستگی تسک را ندارید." }, { status: 403 });

  try {
    const dependency = await prisma.$transaction(async (tx) => {
      const prerequisite = await tx.task.findFirst({
        where: { id: parsed.data.prerequisiteTaskId, projectId: task.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!prerequisite) throw new Error("INVALID_PREREQUISITE");

      const edges = await tx.taskDependency.findMany({
        where: { dependentTask: { projectId: task.projectId, deletedAt: null } },
        select: { dependentTaskId: true, prerequisiteTaskId: true },
      });
      const prerequisitesByTask = new Map<string, string[]>();
      for (const edge of edges) {
        const list = prerequisitesByTask.get(edge.dependentTaskId) ?? [];
        list.push(edge.prerequisiteTaskId);
        prerequisitesByTask.set(edge.dependentTaskId, list);
      }

      const visited = new Set<string>();
      const reachesDependent = (taskId: string): boolean => {
        if (taskId === id) return true;
        if (visited.has(taskId)) return false;
        visited.add(taskId);
        return (prerequisitesByTask.get(taskId) ?? []).some(reachesDependent);
      };
      if (reachesDependent(prerequisite.id)) throw new Error("DEPENDENCY_CYCLE");

      return tx.taskDependency.create({
        data: { dependentTaskId: id, prerequisiteTaskId: prerequisite.id },
        select: {
          id: true,
          prerequisiteTask: {
            select: {
              id: true, title: true, status: true, type: true,
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({ success: true, dependency: dependencyResponse(dependency), message: "وابستگی تسک ثبت شد." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PREREQUISITE") return NextResponse.json({ message: "تسک پیش‌نیاز باید فعال و متعلق به همین پروژه باشد." }, { status: 400 });
    if (error instanceof Error && error.message === "DEPENDENCY_CYCLE") return NextResponse.json({ message: "این وابستگی یک حلقه ایجاد می‌کند." }, { status: 400 });
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ message: "این وابستگی قبلاً ثبت شده است." }, { status: 409 });
    console.error("Create task dependency:", error);
    return NextResponse.json({ message: "خطا در ثبت وابستگی تسک." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });

  const { id } = await context.params;
  const parsed = z.object({ dependencyId: z.uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ message: "اطلاعات وابستگی معتبر نیست." }, { status: 400 });

  const { task, access } = await accessibleTask(actor, id);
  if (!task || !access?.canManage) return NextResponse.json({ message: "اجازه مدیریت وابستگی تسک را ندارید." }, { status: 403 });

  const result = await prisma.taskDependency.deleteMany({ where: { id: parsed.data.dependencyId, dependentTaskId: id } });
  if (result.count !== 1) return NextResponse.json({ message: "وابستگی یافت نشد." }, { status: 404 });
  return NextResponse.json({ success: true, message: "وابستگی حذف شد." });
}
