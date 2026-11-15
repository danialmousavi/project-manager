"use client";

/* eslint-disable @next/next/no-img-element -- Previews must use the authenticated, same-origin attachment route. */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Download, FileArchive, FileSpreadsheet, FileText, FileType, ImageIcon, LoaderCircle, Paperclip, Trash2, UploadCloud, X } from "lucide-react";
import { acceptedAttachmentFiles, validateAttachmentMetadata } from "@/lib/attachment-rules";

type Attachment = {
  id: string;
  uploadBatchId: string | null;
  originalName: string;
  title: string | null;
  description: string | null;
  contentType: string;
  byteSize: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  canDelete: boolean;
  isImage: boolean;
};

type AttachmentsResponse = { attachments: Attachment[]; canUpload: boolean };
type QueuedFileStatus = "queued" | "uploading" | "failed";
type QueuedFile = { id: string; file: File; title: string; description: string; progress: number; status: QueuedFileStatus; error: string };
type UploadFailure = { filename: string; message: string };
type AttachmentBatch = { id: string; attachments: Attachment[] };

function byteSize(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024).toLocaleString("fa-IR")} کیلوبایت`
    : `${(value / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "خطایی رخ داد.";
}

function attachmentUrl(attachment: Attachment) {
  return `/api/v1/task-attachments/${attachment.id}/download`;
}

function isPdf(attachment: Attachment) {
  return attachment.contentType === "application/pdf";
}

function fileKind(attachment: Attachment) {
  if (attachment.isImage) return "تصویر";
  if (isPdf(attachment)) return "PDF";
  if (attachment.contentType.includes("spreadsheet") || attachment.contentType.includes("excel") || attachment.contentType === "text/csv") return "صفحه‌گسترده";
  if (attachment.contentType.includes("word")) return "سند Word";
  if (attachment.contentType === "application/zip") return "فایل فشرده";
  if (attachment.contentType === "text/plain") return "فایل متنی";
  return "فایل";
}

function FileIcon({ attachment, size = 24 }: { attachment: Attachment; size?: number }) {
  if (attachment.isImage) return <ImageIcon size={size} />;
  if (attachment.contentType.includes("spreadsheet") || attachment.contentType.includes("excel") || attachment.contentType === "text/csv") return <FileSpreadsheet size={size} />;
  if (attachment.contentType === "application/zip") return <FileArchive size={size} />;
  if (isPdf(attachment) || attachment.contentType.includes("word")) return <FileType size={size} />;
  return <FileText size={size} />;
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return { message: `پاسخ خالی از سرور دریافت شد (کد ${response.status}).` };
  if (!response.headers.get("content-type")?.includes("application/json")) return { message: `پاسخ نامعتبر از سرور دریافت شد (کد ${response.status}).` };
  try {
    return JSON.parse(text) as { message?: string; attachments?: Attachment[]; canUpload?: boolean; failures?: UploadFailure[] };
  } catch {
    return { message: `پاسخ نامعتبر از سرور دریافت شد (کد ${response.status}).` };
  }
}

export default function TaskAttachments({ taskId }: { taskId: string }) {
  const [data, setData] = useState<AttachmentsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<AttachmentBatch | null>(null);
  const [batchImageIndex, setBatchImageIndex] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/tasks/${taskId}/attachments`, { cache: "no-store", credentials: "same-origin" });
    const body = await responseBody(response);
    if (!response.ok) throw new Error(body.message || "دریافت پیوست‌ها ناموفق بود.");
    setData({ attachments: body.attachments ?? [], canUpload: Boolean(body.canUpload) });
  }, [taskId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause) => setError(errorMessage(cause)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function selectFiles(nextFiles: Iterable<File>) {
    const accepted: QueuedFile[] = [];
    const problems: string[] = [];
    const remainingCapacity = 10 - files.length;

    for (const nextFile of nextFiles) {
      const validationError = validateAttachmentMetadata(nextFile);
      if (validationError) {
        problems.push(`${nextFile.name}: ${validationError}`);
      } else if (accepted.length >= remainingCapacity) {
        problems.push("در هر نوبت حداکثر ۱۰ فایل قابل انتخاب است.");
      } else {
        accepted.push({ id: crypto.randomUUID(), file: nextFile, title: "", description: "", progress: 0, status: "queued", error: "" });
      }
    }

    if (accepted.length > 0) setFiles((current) => [...current, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
    setError(problems.join(" "));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(Array.from(event.target.files ?? []));
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFiles(Array.from(event.dataTransfer.files));
  }

  function updateQueuedFile(id: string, values: Partial<Omit<QueuedFile, "id" | "file">>) {
    setFiles((current) => current.map((queuedFile) => queuedFile.id === id ? { ...queuedFile, ...values } : queuedFile));
  }

  function uploadQueuedFile(queuedFile: QueuedFile, uploadBatchId: string) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append("files", queuedFile.file);
      formData.set("metadata", JSON.stringify([{ title: queuedFile.title, description: queuedFile.description }]));
      formData.set("uploadBatchId", uploadBatchId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/v1/tasks/${taskId}/attachments`);
      xhr.withCredentials = true;
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) updateQueuedFile(queuedFile.id, { progress: Math.round((event.loaded / event.total) * 100) });
      });
      xhr.addEventListener("load", () => {
        let body: { message?: string; failures?: UploadFailure[] } = {};
        try { body = JSON.parse(xhr.responseText) as typeof body; } catch { /* The response message below is sufficient. */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          updateQueuedFile(queuedFile.id, { progress: 100 });
          resolve();
        } else {
          reject(new Error(body.failures?.map((failure) => `${failure.filename}: ${failure.message}`).join(" ") || body.message || "بارگذاری فایل ناموفق بود."));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("ارتباط با سرور هنگام بارگذاری قطع شد.")));
      xhr.send(formData);
    });
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setError("ابتدا حداقل یک فایل انتخاب کنید.");
      return;
    }

    setBusy(true);
    setError("");
    const uploadBatchId = crypto.randomUUID();
    const completedIds = new Set<string>();
    const problems: string[] = [];

    for (const queuedFile of files) {
      updateQueuedFile(queuedFile.id, { status: "uploading", progress: 0, error: "" });
      try {
        await uploadQueuedFile(queuedFile, uploadBatchId);
        completedIds.add(queuedFile.id);
      } catch (cause) {
        const message = errorMessage(cause);
        problems.push(`${queuedFile.file.name}: ${message}`);
        updateQueuedFile(queuedFile.id, { status: "failed", error: message });
      }
    }

    setFiles((current) => current.filter((queuedFile) => !completedIds.has(queuedFile.id)));
    try {
      if (completedIds.size > 0) await load();
    } catch (cause) {
      problems.push(errorMessage(cause));
    } finally {
      setError(problems.join(" "));
      setBusy(false);
    }
  }

  async function remove(attachment: Attachment) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/task-attachments/${attachment.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.message || "حذف پیوست ناموفق بود.");
      if (selectedAttachment?.id === attachment.id) setSelectedAttachment(null);
      setSelectedBatch((current) => {
        if (!current) return null;
        const attachments = current.attachments.filter((item) => item.id !== attachment.id);
        return attachments.length > 0 ? { ...current, attachments } : null;
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const count = data?.attachments.length ?? 0;
  const attachmentBatches = (() => {
    const batches = new Map<string, AttachmentBatch>();
    for (const attachment of data?.attachments ?? []) {
      const id = attachment.uploadBatchId ?? `legacy-${attachment.id}`;
      const batch = batches.get(id);
      if (batch) batch.attachments.push(attachment);
      else batches.set(id, { id, attachments: [attachment] });
    }
    return [...batches.values()];
  })();
  const batchImages = selectedBatch?.attachments.filter((attachment) => attachment.isImage) ?? [];
  const activeBatchImageIndex = batchImages.length > 0 ? batchImageIndex % batchImages.length : 0;
  const activeBatchImage = batchImages[activeBatchImageIndex];
  const batchDocuments = selectedBatch?.attachments.filter((attachment) => !attachment.isImage) ?? [];

  function openBatch(batch: AttachmentBatch) {
    setBatchImageIndex(0);
    setSelectedBatch(batch);
  }

  function moveBatchImage(direction: 1 | -1) {
    if (batchImages.length < 2) return;
    setBatchImageIndex((current) => (current + direction + batchImages.length) % batchImages.length);
  }

  return <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h5 className="flex items-center gap-1.5 text-xs font-bold text-indigo-900"><Paperclip size={15} />فایل‌ها و مستندات</h5>
        <p className="mt-1 text-[11px] text-indigo-700">{count === 0 ? "هنوز فایلی ثبت نشده است." : `${count.toLocaleString("fa-IR")} فایل به این تسک پیوست شده است.`}</p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">مشاهده و مدیریت فایل‌ها</button>
    </div>
    {error && !open && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attachments-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section dir="rtl" className="w-full max-w-4xl overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 bg-gradient-to-l from-indigo-700 to-violet-700 px-5 py-4 text-white">
          <div><p className="text-[11px] font-bold text-indigo-100">پیوست‌های وظیفه</p><h2 id="attachments-title" className="mt-1 text-lg font-extrabold">فایل‌ها و مستندات</h2><p className="mt-1 text-xs text-indigo-100">{count.toLocaleString("fa-IR")} فایل ثبت شده</p></div>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg p-2 text-indigo-100 hover:bg-white/15 hover:text-white disabled:opacity-50" aria-label="بستن"><X size={20} /></button>
        </header>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          {data?.canUpload && <form onSubmit={(event) => void upload(event)} className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-950"><UploadCloud size={18} />بارگذاری فایل جدید</div>
            <input ref={inputRef} type="file" multiple accept={acceptedAttachmentFiles} onChange={onFileChange} className="sr-only" />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={onDrop} className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${dragActive ? "border-indigo-500 bg-indigo-100" : "border-indigo-200 bg-white hover:border-indigo-400"} disabled:cursor-not-allowed disabled:opacity-60`}>
              <UploadCloud size={25} className="text-indigo-600" /><span className="mt-2 text-sm font-bold text-slate-800">{files.length > 0 ? `${files.length.toLocaleString("fa-IR")} فایل در صف آپلود` : "فایل‌ها را اینجا رها کنید یا انتخاب کنید"}</span><span className="mt-1 text-[11px] text-slate-500">تصویر، PDF، Word، Excel، CSV، متن یا ZIP — هر فایل حداکثر ۲۵ مگابایت، تا ۱۰ فایل</span>
            </button>
            {files.length > 0 && <ul className="mt-3 space-y-3">{files.map(({ id, file, title, description, progress, status, error: fileError }) => <li key={id} className="rounded-xl border border-indigo-100 bg-white p-3"><div className="flex items-center gap-2"><FileIcon attachment={{ contentType: file.type, isImage: file.type.startsWith("image/") } as Attachment} size={16} /><span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">{file.name}</span><span className="text-[11px] text-slate-500">{byteSize(file.size)}</span><button type="button" disabled={busy} onClick={() => setFiles((current) => current.filter((queuedFile) => queuedFile.id !== id))} className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`حذف ${file.name} از صف`}><X size={15} /></button></div>{status === "uploading" && <div className="mt-3"><div className="flex justify-between text-[11px] font-bold text-indigo-700"><span>در حال بارگذاری</span><span>{progress.toLocaleString("fa-IR")}٪</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${progress}%` }} /></div></div>}{status === "failed" && <p className="mt-2 text-[11px] font-bold text-rose-600">{fileError || "بارگذاری فایل ناموفق بود."}</p>}<div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-[11px] font-bold text-slate-600">عنوان اختیاری<input value={title} maxLength={200} disabled={busy} onChange={(event) => updateQueuedFile(id, { title: event.target.value, description })} placeholder="عنوان این فایل" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-normal outline-none focus:border-indigo-400" /></label><label className="text-[11px] font-bold text-slate-600">توضیح اختیاری<textarea value={description} maxLength={2000} disabled={busy} onChange={(event) => updateQueuedFile(id, { title, description: event.target.value })} placeholder="توضیح این فایل" rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-normal outline-none focus:border-indigo-400" /></label></div></li>)}</ul>}
            <div className="mt-3 flex justify-end"><button type="submit" disabled={busy || files.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "در حال بارگذاری…" : `بارگذاری ${files.length.toLocaleString("fa-IR")} فایل`}</button></div>
          </form>}

          {!data && <div className="flex justify-center py-10"><LoaderCircle size={22} className="animate-spin text-indigo-600" /></div>}
          {data?.attachments.length === 0 && <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-8 text-center"><Paperclip className="mx-auto text-indigo-500" size={27} /><p className="mt-3 text-sm font-bold text-indigo-950">هنوز فایلی ثبت نشده است</p>{!data.canUpload && <p className="mt-1 text-xs text-indigo-700">شما فقط اجازهٔ مشاهدهٔ پیوست‌ها را دارید.</p>}</div>}
          {attachmentBatches.length > 0 && <div className="grid gap-4 md:grid-cols-2">{attachmentBatches.map((batch) => { const first = batch.attachments[0]; const images = batch.attachments.filter((attachment) => attachment.isImage); const remaining = batch.attachments.length - 3; return <article key={batch.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative h-36 overflow-hidden bg-slate-100">{images.length > 0 ? <div className={`grid h-full w-full gap-0.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{images.slice(0, 4).map((attachment) => <img key={attachment.id} src={attachmentUrl(attachment)} alt="" className="h-full w-full object-cover" />)}</div> : <div className="flex h-full flex-col items-center justify-center gap-2 text-indigo-600"><FileIcon attachment={first} size={38} /><span className="text-xs font-bold">{fileKind(first)}</span></div>}<span className="absolute left-2 top-2 rounded-md bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">{batch.attachments.length.toLocaleString("fa-IR")} فایل</span></div><div className="p-3"><h3 className="truncate text-sm font-bold text-slate-900">{batch.attachments.length === 1 ? first.title || first.originalName : `${batch.attachments.length.toLocaleString("fa-IR")} فایل در یک ارسال`}</h3><p className="mt-1 text-[11px] text-slate-600">ارسال توسط {first.uploadedBy.name} · {dateTime(first.createdAt)}</p><ul className="mt-3 space-y-1.5">{batch.attachments.slice(0, 3).map((attachment) => <li key={attachment.id} className="flex items-center gap-2 text-xs text-slate-600"><FileIcon attachment={attachment} size={14} /><span className="min-w-0 flex-1 truncate">{attachment.title || attachment.originalName}</span><a href={attachmentUrl(attachment)} download className="rounded p-1 text-indigo-600 hover:bg-indigo-50" aria-label={`دانلود ${attachment.originalName}`}><Download size={14} /></a>{attachment.canDelete && <button type="button" disabled={busy} onClick={() => void remove(attachment)} className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`حذف ${attachment.originalName}`}><Trash2 size={14} /></button>}</li>)}</ul>{remaining > 0 && <p className="mt-2 text-[11px] font-bold text-indigo-600">و {remaining.toLocaleString("fa-IR")} فایل دیگر</p>}<button type="button" onClick={() => openBatch(batch)} className="mt-3 w-full rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">مشاهدهٔ این ارسال</button></div></article>; })}</div>}
        </div>
      </section>
    </div>}

    {selectedBatch && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="batch-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBatch(null); }}>
      <section dir="rtl" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold text-indigo-600">فایل‌های یک ارسال</p><h2 id="batch-preview-title" className="mt-1 text-lg font-extrabold text-slate-950">{selectedBatch.attachments.length.toLocaleString("fa-IR")} فایل ارسال‌شده توسط {selectedBatch.attachments[0].uploadedBy.name}</h2><p className="mt-1 text-xs text-slate-500">{dateTime(selectedBatch.attachments[0].createdAt)}</p></div><button type="button" onClick={() => setSelectedBatch(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="بستن"><X size={20} /></button></header>
        <div className="space-y-5 p-5">
          {activeBatchImage && <section><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><ImageIcon size={18} className="text-indigo-600" />تصاویر این ارسال</h3><span className="text-xs font-bold text-indigo-600">{(activeBatchImageIndex + 1).toLocaleString("fa-IR")} از {batchImages.length.toLocaleString("fa-IR")}</span></div><div className="relative overflow-hidden rounded-2xl bg-slate-950"><button type="button" onClick={() => setSelectedAttachment(activeBatchImage)} className="block h-64 w-full sm:h-[26rem]"><img src={attachmentUrl(activeBatchImage)} alt={activeBatchImage.title || activeBatchImage.originalName} className="h-full w-full object-contain" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-4 pb-3 pt-10 text-right text-sm font-bold text-white">{activeBatchImage.title || activeBatchImage.originalName}</span></button>{batchImages.length > 1 && <><button type="button" onClick={() => moveBatchImage(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-indigo-700 shadow hover:bg-white" aria-label="تصویر بعدی"><ChevronRight size={20} /></button><button type="button" onClick={() => moveBatchImage(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-indigo-700 shadow hover:bg-white" aria-label="تصویر قبلی"><ChevronLeft size={20} /></button></>}</div><div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-[11px] font-extrabold text-indigo-600">عنوان تصویر</p><h4 className="mt-1 text-base font-extrabold text-slate-950">{activeBatchImage.title || activeBatchImage.originalName}</h4><div className="mt-3 border-t border-indigo-100 pt-3"><p className="text-[11px] font-extrabold text-indigo-600">توضیحات</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeBatchImage.description || "توضیحی برای این تصویر ثبت نشده است."}</p></div></div>{batchImages.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{batchImages.map((attachment, index) => <button key={attachment.id} type="button" onClick={() => setBatchImageIndex(index)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${index === activeBatchImageIndex ? "border-indigo-600" : "border-transparent opacity-70 hover:opacity-100"}`} aria-label={`نمایش ${attachment.title || attachment.originalName}`}><img src={attachmentUrl(attachment)} alt="" className="h-full w-full object-cover" /></button>)}</div>}</section>}
          {batchDocuments.length > 0 && <section><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><FileText size={18} className="text-indigo-600" />فایل‌ها و مستندات این ارسال</h3><div className="grid gap-3 sm:grid-cols-2">{batchDocuments.map((attachment) => <button key={attachment.id} type="button" onClick={() => setSelectedAttachment(attachment)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-right hover:border-indigo-300 hover:bg-indigo-50"><span className="flex size-10 items-center justify-center rounded-xl bg-white text-indigo-600"><FileIcon attachment={attachment} size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{attachment.title || attachment.originalName}</span><span className="mt-1 block truncate text-xs text-slate-500">{attachment.originalName} · {byteSize(attachment.byteSize)}</span></span></button>)}</div></section>}
        </div>
      </section>
    </div>}

    {selectedAttachment && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attachment-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAttachment(null); }}>
      <section dir="rtl" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="min-w-0"><p className="text-xs font-bold text-indigo-600">جزئیات پیوست</p><h2 id="attachment-preview-title" className="mt-1 truncate text-lg font-extrabold text-slate-950">{selectedAttachment.title || selectedAttachment.originalName}</h2></div><button type="button" onClick={() => setSelectedAttachment(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="بستن"><X size={20} /></button></header>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3"><div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">{selectedAttachment.isImage ? <img src={attachmentUrl(selectedAttachment)} alt={selectedAttachment.title || selectedAttachment.originalName} className="max-h-[60vh] w-full object-contain" /> : isPdf(selectedAttachment) ? <iframe src={attachmentUrl(selectedAttachment)} title={selectedAttachment.originalName} className="h-[60vh] w-full bg-white" /> : <div className="p-8 text-center text-indigo-700"><FileIcon attachment={selectedAttachment} size={54} /><p className="mt-3 text-sm font-bold text-slate-800">پیش‌نمایش داخلی برای {fileKind(selectedAttachment)} در دسترس نیست.</p><p className="mt-1 text-xs text-slate-500">فایل را دانلود کنید تا با برنامهٔ مناسب باز شود.</p></div>}</div>{selectedAttachment.isImage && <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-[11px] font-extrabold text-indigo-600">عنوان تصویر</p><h3 className="mt-1 text-base font-extrabold text-slate-950">{selectedAttachment.title || selectedAttachment.originalName}</h3><div className="mt-3 border-t border-indigo-100 pt-3"><p className="text-[11px] font-extrabold text-indigo-600">توضیحات</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedAttachment.description || "توضیحی برای این تصویر ثبت نشده است."}</p></div></div>}</div>
          <aside className="space-y-4"><div><p className="text-xs font-bold text-slate-500">نام فایل</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{selectedAttachment.originalName}</p></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="font-bold text-slate-500">نوع</p><p className="mt-1 text-slate-800">{fileKind(selectedAttachment)}</p></div><div><p className="font-bold text-slate-500">حجم</p><p className="mt-1 text-slate-800">{byteSize(selectedAttachment.byteSize)}</p></div></div><div><p className="text-xs font-bold text-slate-500">ارسال‌کننده</p><p className="mt-1 text-sm text-slate-800">{selectedAttachment.uploadedBy.name}</p></div><div><p className="text-xs font-bold text-slate-500">زمان ارسال</p><p className="mt-1 text-sm text-slate-800">{dateTime(selectedAttachment.createdAt)}</p></div>{!selectedAttachment.isImage && selectedAttachment.description && <div><p className="text-xs font-bold text-slate-500">توضیحات</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedAttachment.description}</p></div>}<a href={attachmentUrl(selectedAttachment)} download className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><Download size={17} />دانلود فایل</a>{selectedAttachment.canDelete && <button type="button" disabled={busy} onClick={() => void remove(selectedAttachment)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={17} />حذف فایل</button>}</aside>
        </div>
      </section>
    </div>}
  </section>;
}
