import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProjectController } from "@/lib/role-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import { deleteAttachmentObject } from "@/lib/task-attachments";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  if (isProjectController(actor.role)) return NextResponse.json({ message: "ناظر کنترل پروژه فقط دسترسی مشاهده دارد." }, { status: 403 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه پیوست نامعتبر است." }, { status: 400 });

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id },
    select: { id: true, storageKey: true, uploadedById: true, task: { select: { projectId: true, assigneeId: true, deletedAt: true } } },
  });
  if (!attachment || attachment.task.deletedAt) return NextResponse.json({ message: "پیوست پیدا نشد." }, { status: 404 });

  const access = await getTaskProjectAccess(actor, attachment.task.projectId);
  const canDelete = access && (access.canManage || attachment.uploadedById === actor.id);
  if (!canDelete) return NextResponse.json({ message: "اجازه حذف این پیوست را ندارید." }, { status: 403 });

  await prisma.taskAttachment.delete({ where: { id } });
  deleteAttachmentObject(attachment.storageKey).catch((error) => console.error("Delete attachment object:", error));

  return NextResponse.json({ success: true, message: "پیوست حذف شد." });
}
