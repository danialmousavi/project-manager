import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.enum(["true", "false"]).default("false"),
});

function unauthorized() {
  return NextResponse.json(
    { message: "ابتدا وارد حساب شوید." },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return unauthorized();

  const parsed = listSchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    unreadOnly: request.nextUrl.searchParams.get("unreadOnly") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "پارامترهای اعلان معتبر نیست." }, { status: 400 });
  }

  const { limit, unreadOnly } = parsed.data;
  const where = {
    userId: actor.id,
    ...(unreadOnly === "true" ? { readAt: null } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        projectId: true,
        payload: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: actor.id, readAt: null },
    }),
  ]);

  const hasMore = items.length > limit;
  const notifications = items.slice(0, limit).map((notification) => ({
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }));

  return NextResponse.json(
    { success: true, notifications, unreadCount, hasMore },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return unauthorized();

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  }

  const result = await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    updatedCount: result.count,
    message: "همه اعلان‌ها خوانده شدند.",
  });
}
