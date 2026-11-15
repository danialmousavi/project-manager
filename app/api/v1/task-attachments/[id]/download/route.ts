import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProjectController } from "@/lib/role-access";
import { contentDisposition, downloadAttachmentObject } from "@/lib/task-attachments";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه پیوست نامعتبر است." }, { status: 400 });

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id },
    select: { storageKey: true, originalName: true, contentType: true, task: { select: { projectId: true, assigneeId: true, deletedAt: true } } },
  });
  if (!attachment || attachment.task.deletedAt) return NextResponse.json({ message: "پیوست پیدا نشد." }, { status: 404 });

  const access = await getTaskProjectAccess(actor, attachment.task.projectId);
  if (!access || (!access.canManage && !isProjectController(actor.role) && attachment.task.assigneeId !== actor.id)) {
    return NextResponse.json({ message: "اجازه دریافت این پیوست را ندارید." }, { status: 403 });
  }

  try {
    const file = await downloadAttachmentObject(attachment.storageKey);
    return new NextResponse(file.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": attachment.contentType || file.contentType,
        "Content-Disposition": contentDisposition(attachment.originalName, attachment.contentType),
        "Cache-Control": "private, no-store",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Download task attachment:", error);
    return NextResponse.json({ message: "دریافت فایل انجام نشد." }, { status: 503 });
  }
}
