import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";
import { deleteAttachmentObject } from "@/lib/task-attachments";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  const { id: uploadBatchId } = await context.params;
  if (!z.uuid().safeParse(uploadBatchId).success) return NextResponse.json({ message: "شناسه ارسال نامعتبر است." }, { status: 400 });

  const attachments = await prisma.taskAttachment.findMany({
    where: { uploadBatchId },
    select: {
      id: true,
      storageKey: true,
      uploadedById: true,
      task: { select: { projectId: true, assigneeId: true, deletedAt: true } },
    },
  });
  if (attachments.length === 0 || attachments.some((attachment) => attachment.task.deletedAt)) {
    return NextResponse.json({ message: "ارسال پیدا نشد." }, { status: 404 });
  }

  const projectIds = [...new Set(attachments.map((attachment) => attachment.task.projectId))];
  if (projectIds.length !== 1) return NextResponse.json({ message: "ارسال نامعتبر است." }, { status: 400 });

  const access = await getTaskProjectAccess(actor, projectIds[0]);
  if (access?.isProjectController) return NextResponse.json({ message: "ناظر کنترل پروژه فقط دسترسی مشاهده دارد." }, { status: 403 });
  const canDelete = access && (
    access.canManage || attachments.every((attachment) =>
      attachment.task.assigneeId === actor.id &&
      attachment.uploadedById === actor.id
    )
  );
  if (!canDelete) return NextResponse.json({ message: "اجازه حذف این ارسال را ندارید." }, { status: 403 });

  await prisma.taskAttachment.deleteMany({ where: { id: { in: attachments.map((attachment) => attachment.id) } } });
  void Promise.allSettled(attachments.map((attachment) => deleteAttachmentObject(attachment.storageKey))).then((results) => {
    if (results.some((result) => result.status === "rejected")) console.error("Delete attachment batch objects: one or more objects failed to delete.");
  });

  return NextResponse.json({ success: true, count: attachments.length, message: "ارسال و همه فایل‌های آن حذف شد." });
}
