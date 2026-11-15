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
import { validateAttachmentMetadata } from "@/lib/attachment-rules";

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

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasExpectedSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === "image/gif") return startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39]);
  if (contentType === "image/webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  if (contentType === "application/pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (contentType === "application/zip" || contentType.includes("openxmlformats")) return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]);
  if (contentType === "application/msword" || contentType === "application/vnd.ms-excel") return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (contentType === "text/plain" || contentType === "text/csv") return !bytes.includes(0);
  return false;
}

export async function validateAttachment(file: File) {
  const metadataError = validateAttachmentMetadata(file);
  if (metadataError) return metadataError;

  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (!hasExpectedSignature(file.type, bytes)) return "محتوای فایل با نوع انتخاب‌شده مطابقت ندارد.";

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
