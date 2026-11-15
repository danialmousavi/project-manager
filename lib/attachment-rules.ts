export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const allowedAttachmentTypes: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-excel": ["xls"],
  "text/csv": ["csv"],
  "text/plain": ["txt"],
  "application/zip": ["zip"],
};

export const acceptedAttachmentFiles = Object.values(allowedAttachmentTypes).flat().map((extension) => `.${extension}`).join(",");

function extensionOf(filename: string) {
  return filename.split(".").at(-1)?.toLowerCase() ?? "";
}

export function validateAttachmentMetadata(file: Pick<File, "name" | "size" | "type">) {
  if (!file.name || file.name.length > 255 || file.size === 0) return "نام یا محتوای فایل معتبر نیست.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "حجم هر فایل حداکثر ۲۵ مگابایت است.";

  const acceptedExtensions = allowedAttachmentTypes[file.type];
  if (!acceptedExtensions?.includes(extensionOf(file.name))) return "نوع فایل مجاز نیست.";

  return null;
}
