import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProjectController } from "@/lib/role-access";
import { isAllowedOrigin } from "@/lib/security/origin";
import {
  createAttachmentStorageKey,
  deleteAttachmentObject,
  uploadAttachment,
  validateAttachment,
} from "@/lib/task-attachments";
import { getTaskProjectAccess } from "@/lib/task-access";

type Context = { params: Promise<{ id: string }> };

const metadataSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

async function taskAccess(actor: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, projectId: true, assigneeId: true },
  });
  if (!task) return null;

  const access = await getTaskProjectAccess(actor, task.projectId);
  if (!access || (!access.canManage && !isProjectController(actor.role) && task.assigneeId !== actor.id)) {
    return null;
  }

  return { task, canManage: access.canManage, canUpload: access.canManage || task.assigneeId === actor.id };
}

function attachmentResponse(attachment: {
  id: string;
  originalName: string;
  title: string | null;
  description: string | null;
  contentType: string;
  byteSize: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}, canDelete: boolean) {
  return {
    ...attachment,
    createdAt: attachment.createdAt.toISOString(),
    canDelete,
    isImage: attachment.contentType.startsWith("image/"),
  };
}

export async function GET(_request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه تسک نامعتبر است." }, { status: 400 });

  const permitted = await taskAccess(actor, id);
  if (!permitted) return NextResponse.json({ message: "اجازه مشاهده پیوست‌ها را ندارید." }, { status: 403 });

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      title: true,
      description: true,
      contentType: true,
      byteSize: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    success: true,
    canUpload: permitted.canUpload && !isProjectController(actor.role),
    attachments: attachments.map((attachment) => attachmentResponse(
      attachment,
      !isProjectController(actor.role) && (permitted.canManage || attachment.uploadedBy.id === actor.id),
    )),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  if (isProjectController(actor.role)) return NextResponse.json({ message: "ناظر کنترل پروژه فقط دسترسی مشاهده دارد." }, { status: 403 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه تسک نامعتبر است." }, { status: 400 });

  const permitted = await taskAccess(actor, id);
  if (!permitted?.canUpload) return NextResponse.json({ message: "اجازه بارگذاری فایل را ندارید." }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const parsedMetadata = metadataSchema.safeParse({
    title: formData?.get("title") || undefined,
    description: formData?.get("description") || undefined,
  });

  if (!(file instanceof File) || !parsedMetadata.success) {
    return NextResponse.json({ message: "اطلاعات فایل معتبر نیست." }, { status: 400 });
  }

  const validationError = await validateAttachment(file);
  if (validationError) return NextResponse.json({ message: validationError }, { status: 400 });

  const storageKey = createAttachmentStorageKey(id, file.name);
  try {
    await uploadAttachment({ key: storageKey, file });
  } catch (error) {
    console.error("Upload task attachment:", error);
    return NextResponse.json({ message: "بارگذاری فایل انجام نشد." }, { status: 503 });
  }

  try {
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        uploadedById: actor.id,
        storageKey,
        originalName: file.name,
        title: parsedMetadata.data.title || null,
        description: parsedMetadata.data.description || null,
        contentType: file.type,
        byteSize: file.size,
      },
      select: {
        id: true, originalName: true, title: true, description: true,
        contentType: true, byteSize: true, createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, attachment: attachmentResponse(attachment, true) }, { status: 201 });
  } catch (error) {
    await deleteAttachmentObject(storageKey).catch(() => undefined);
    console.error("Create task attachment record:", error);
    return NextResponse.json({ message: "ثبت اطلاعات فایل انجام نشد." }, { status: 500 });
  }
}
