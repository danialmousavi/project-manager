
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  role: z.enum(["MANAGER", "EMPLOYEE", "CONTROLLER"]),
  q: z.string().trim().max(100).default(""),
  projectId: z.uuid().optional(),
});

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
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "پارامترهای جست‌وجو نامعتبر است" },
      { status: 400 }
    );
  }

  const { role, q, projectId } = parsed.data;

  // Admin can search users for creating a project.
  // Managers may search only when managing their project.
  if (actor.role !== "ADMIN") {
    if (actor.role !== "MANAGER" || !projectId) {
      return NextResponse.json(
        { message: "دسترسی غیرمجاز" },
        { status: 403 }
      );
    }
  }

  if (projectId) {
    const hasAccess = await prisma.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
        ...(actor.role === "ADMIN"
          ? {}
          : {
              members: {
                some: {
                  userId: actor.id,
                  role: "MANAGER",
                },
              },
            }),
      },
      select: { id: true },
    });

    if (!hasAccess) {
      return NextResponse.json(
        { message: "دسترسی به این پروژه مجاز نیست" },
        { status: 403 }
      );
    }
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role,
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
