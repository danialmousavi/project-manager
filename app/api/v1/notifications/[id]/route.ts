import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "شناسه اعلان معتبر نیست." }, { status: 400 });
  }

  const result = await prisma.notification.updateMany({
    where: { id, userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({
      where: { id, userId: actor.id },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json({ message: "اعلان یافت نشد." }, { status: 404 });
    }
  }

  return NextResponse.json({ success: true, message: "اعلان خوانده شد." });
}
