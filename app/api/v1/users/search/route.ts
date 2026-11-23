
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canCreateCompanyProject, getCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";

const querySchema = z.object({
  role: z.enum(["MANAGER", "EMPLOYEE", "CONTROLLER"]),
  q: z.string().trim().max(100).default(""),
  projectId: z.uuid().optional(),
  companyId: z.uuid().optional(),
}).refine((value) => value.projectId || value.companyId, {
  message: "شرکت یا پروژه الزامی است",
});

const companyRoleByProjectRole = {
  MANAGER: "PROJECT_MANAGER",
  EMPLOYEE: "EXPERT",
  CONTROLLER: "CONTROLLER",
} as const;

export async function GET(request: NextRequest) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  const parsed = querySchema.safeParse({
    role: request.nextUrl.searchParams.get("role"),
    q: request.nextUrl.searchParams.get("q") ?? "",
    projectId:
      request.nextUrl.searchParams.get("projectId") ??
      undefined,
    companyId:
      request.nextUrl.searchParams.get("companyId") ??
      undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "پارامترهای جست‌وجو نامعتبر است" },
      { status: 400 }
    );
  }

  const { role, q, projectId, companyId: requestedCompanyId } = parsed.data;
  let companyId = requestedCompanyId;

  if (projectId) {
    const access = await getTaskProjectAccess(actor, projectId);
    const project = access?.canManage
      ? await prisma.project.findUnique({
          where: { id: projectId },
          select: { companyId: true },
        })
      : null;

    if (!project) {
      return NextResponse.json(
        { message: "دسترسی به این پروژه مجاز نیست" },
        { status: 403 }
      );
    }

    companyId = project.companyId;
  } else if (companyId) {
    const access = await getCompanyAccess(actor, companyId);

    if (!access || !canCreateCompanyProject(access)) {
      return NextResponse.json(
        { message: "دسترسی به شرکت مجاز نیست" },
        { status: 403 }
      );
    }
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      companyMemberships: {
        some: {
          companyId,
          isActive: true,
          role: companyRoleByProjectRole[role],
          company: { status: "ACTIVE" },
        },
      },
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: "asc",
    },
    take: 20,
  });

  return NextResponse.json(
    {
      success: true,
      users,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
