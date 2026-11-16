import { randomUUID } from "node:crypto";
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

const MAX_FILES_PER_REQUEST = 10;
const perFileMetadataSchema = z.array(metadataSchema).min(1).max(MAX_FILES_PER_REQUEST);

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
  uploadBatchId: string | null;
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
      uploadBatchId: true,
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
  const parsedSharedMetadata = metadataSchema.safeParse({
    title: formData?.get("title") || undefined,
    description: formData?.get("description") || undefined,
  });
  const metadataValue = formData?.get("metadata");
  const uploadBatchValue = formData?.get("uploadBatchId");
  let perFileMetadata: z.infer<typeof metadataSchema>[] | null = null;

  const parsedUploadBatchId = uploadBatchValue === null
    ? null
    : typeof uploadBatchValue === "string" ? z.uuid().safeParse(uploadBatchValue) : null;
  if (uploadBatchValue !== null && (!parsedUploadBatchId || !parsedUploadBatchId.success)) {
    return NextResponse.json({ message: "شناسه بارگذاری معتبر نیست." }, { status: 400 });
  }

  if (metadataValue !== null) {
    if (typeof metadataValue !== "string") {
      return NextResponse.json({ message: "اطلاعات فایل معتبر نیست." }, { status: 400 });
    }

    const parsedMetadata = perFileMetadataSchema.safeParse((() => {
      try {
        return JSON.parse(metadataValue);
      } catch {
        return null;
      }
    })());
    if (!parsedMetadata.success) {
      return NextResponse.json({ message: "اطلاعات فایل معتبر نیست." }, { status: 400 });
    }
    perFileMetadata = parsedMetadata.data;
  }

  const multiFileEntries = formData?.getAll("files") ?? [];
  const files = multiFileEntries.length > 0
    ? multiFileEntries.filter((entry): entry is File => entry instanceof File)
    : [formData?.get("file")].filter((entry): entry is File => entry instanceof File);

  const sharedMetadata = parsedSharedMetadata.success ? parsedSharedMetadata.data : null;
  if ((!perFileMetadata && !sharedMetadata) || files.length === 0) {
    return NextResponse.json({ message: "اطلاعات فایل معتبر نیست." }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ message: `در هر نوبت حداکثر ${MAX_FILES_PER_REQUEST.toLocaleString("fa-IR")} فایل قابل بارگذاری است.` }, { status: 400 });
  }
  if (perFileMetadata && perFileMetadata.length !== files.length) {
    return NextResponse.json({ message: "تعداد اطلاعات فایل‌ها با تعداد فایل‌های ارسالی برابر نیست." }, { status: 400 });
  }

  const attachments: ReturnType<typeof attachmentResponse>[] = [];
  const failures: { filename: string; message: string }[] = [];
  const uploadBatchId = parsedUploadBatchId?.data ?? randomUUID();

  for (const [index, file] of files.entries()) {
    const metadata = perFileMetadata?.[index] ?? sharedMetadata!;
    const validationError = await validateAttachment(file);
    if (validationError) {
      failures.push({ filename: file.name, message: validationError });
      continue;
    }

    const storageKey = createAttachmentStorageKey(id, file.name);
    try {
      await uploadAttachment({ key: storageKey, file });
    } catch (error) {
      console.error("Upload task attachment:", error);
      failures.push({ filename: file.name, message: "بارگذاری فایل انجام نشد." });
      continue;
    }

    try {
      const attachment = await prisma.taskAttachment.create({
        data: {
          taskId: id,
          uploadedById: actor.id,
          uploadBatchId,
          storageKey,
          originalName: file.name,
          title: metadata.title || null,
          description: metadata.description || null,
          contentType: file.type,
          byteSize: file.size,
        },
        select: {
          id: true, uploadBatchId: true, originalName: true, title: true, description: true,
          contentType: true, byteSize: true, createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
      });

      attachments.push(attachmentResponse(attachment, true));
    } catch (error) {
      await deleteAttachmentObject(storageKey).catch(() => undefined);
      console.error("Create task attachment record:", error);
      failures.push({ filename: file.name, message: "ثبت اطلاعات فایل انجام نشد." });
    }
  }

  if (attachments.length === 0) {
    return NextResponse.json({
      message: failures[0]?.message || "هیچ فایلی بارگذاری نشد.",
      attachments: [],
      failures,
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    attachment: attachments[0],
    attachments,
    failures,
    message: failures.length > 0 ? "بعضی از فایل‌ها بارگذاری نشدند." : undefined,
  }, { status: 201 });
}
