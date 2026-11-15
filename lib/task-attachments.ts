import "server-only";

import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const allowedTypes = new Map([
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]],
  ["image/gif", ["gif"]],
  ["application/pdf", ["pdf"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx"]],
  ["application/msword", ["doc"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["xlsx"]],
  ["application/vnd.ms-excel", ["xls"]],
  ["text/csv", ["csv"]],
  ["text/plain", ["txt"]],
  ["application/zip", ["zip"]],
]);

const globalForAttachmentStorage = globalThis as unknown as {
  attachmentBucketReady?: Promise<void>;
};

function attachmentConfig() {
  const endpoint = process.env.MINIO_ENDPOINT?.trim();
  const accessKeyId = process.env.MINIO_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.MINIO_SECRET_KEY?.trim();
  const bucket = process.env.MINIO_BUCKET?.trim();

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("MINIO_CONFIG_MISSING");
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function getClient() {
  const config = attachmentConfig();
  return {
    bucket: config.bucket,
    client: new S3Client({
      endpoint: config.endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

async function ensureBucket() {
  if (!globalForAttachmentStorage.attachmentBucketReady) {
    globalForAttachmentStorage.attachmentBucketReady = (async () => {
      const { client, bucket } = getClient();
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      }
    })().catch((error) => {
      globalForAttachmentStorage.attachmentBucketReady = undefined;
      throw error;
    });
  }

  await globalForAttachmentStorage.attachmentBucketReady;
}

function extensionOf(filename: string) {
  return filename.split(".").at(-1)?.toLowerCase() ?? "";
}

export function validateAttachment(file: File) {
  if (!file.name || file.name.length > 255 || file.size === 0) {
    return "نام یا محتوای فایل معتبر نیست.";
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "حجم هر فایل حداکثر ۲۵ مگابایت است.";
  }

  const acceptedExtensions = allowedTypes.get(file.type);
  if (!acceptedExtensions?.includes(extensionOf(file.name))) {
    return "نوع فایل مجاز نیست.";
  }

  return null;
}

export function createAttachmentStorageKey(taskId: string, filename: string) {
  return `tasks/${taskId}/${randomUUID()}.${extensionOf(filename)}`;
}

export async function uploadAttachment({
  key,
  file,
}: {
  key: string;
  file: File;
}) {
  const { client, bucket } = getClient();
  await ensureBucket();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type,
    ContentLength: file.size,
  }));
}

export async function deleteAttachmentObject(key: string) {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function downloadAttachmentObject(key: string) {
  const { client, bucket } = getClient();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!result.Body) throw new Error("ATTACHMENT_OBJECT_MISSING");

  return {
    contentType: result.ContentType ?? "application/octet-stream",
    bytes: await result.Body.transformToByteArray(),
  };
}

export function contentDisposition(filename: string, contentType: string) {
  const safeFallback = filename.replace(/[^A-Za-z0-9._-]/g, "_") || "attachment";
  const disposition = contentType.startsWith("image/") || contentType === "application/pdf"
    ? "inline"
    : "attachment";

  return `${disposition}; filename="${safeFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
