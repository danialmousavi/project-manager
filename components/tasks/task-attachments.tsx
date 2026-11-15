"use client";

/* eslint-disable @next/next/no-img-element -- Previews must use the authenticated, same-origin attachment route. */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Download, Eye, FileArchive, FileSpreadsheet, FileText, FileType, ImageIcon, LoaderCircle, Paperclip, Trash2, UploadCloud, X } from "lucide-react";
import { acceptedAttachmentFiles, validateAttachmentMetadata } from "@/lib/attachment-rules";

type Attachment = {
  id: string;
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
    return JSON.parse(text) as { message?: string; attachments?: Attachment[]; canUpload?: boolean };
  } catch {
    return { message: `پاسخ نامعتبر از سرور دریافت شد (کد ${response.status}).` };
  }
}

export default function TaskAttachments({ taskId }: { taskId: string }) {
  const [data, setData] = useState<AttachmentsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
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

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const validationError = validateAttachmentMetadata(nextFile);
    if (validationError) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setError(validationError);
      return;
    }
    setFile(nextFile);
    setError("");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("ابتدا یک فایل انتخاب کنید.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", title);
      formData.set("description", description);
      const response = await fetch(`/api/v1/tasks/${taskId}/attachments`, { method: "POST", credentials: "same-origin", body: formData });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.message || "بارگذاری فایل ناموفق بود.");
      setFile(null);
      setTitle("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
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
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const count = data?.attachments.length ?? 0;

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
            <input ref={inputRef} type="file" accept={acceptedAttachmentFiles} onChange={onFileChange} className="sr-only" />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={onDrop} className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${dragActive ? "border-indigo-500 bg-indigo-100" : "border-indigo-200 bg-white hover:border-indigo-400"} disabled:cursor-not-allowed disabled:opacity-60`}>
              <UploadCloud size={25} className="text-indigo-600" /><span className="mt-2 text-sm font-bold text-slate-800">{file ? file.name : "فایل را اینجا رها کنید یا انتخاب کنید"}</span><span className="mt-1 text-[11px] text-slate-500">تصویر، PDF، Word، Excel، CSV، متن یا ZIP — حداکثر ۲۵ مگابایت</span>{file && <span className="mt-1 text-[11px] text-indigo-700">{byteSize(file.size)}</span>}
            </button>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">عنوان اختیاری<input value={title} maxLength={200} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً گزارش تست" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-400" /></label><label className="text-xs font-bold text-slate-700">توضیح اختیاری<textarea value={description} maxLength={2000} disabled={busy} onChange={(event) => setDescription(event.target.value)} placeholder="توضیح کوتاه برای فایل" rows={2} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-indigo-400" /></label></div>
            <div className="mt-3 flex justify-end"><button type="submit" disabled={busy || !file} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "در حال بارگذاری…" : "بارگذاری فایل"}</button></div>
          </form>}

          {!data && <div className="flex justify-center py-10"><LoaderCircle size={22} className="animate-spin text-indigo-600" /></div>}
          {data?.attachments.length === 0 && <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-8 text-center"><Paperclip className="mx-auto text-indigo-500" size={27} /><p className="mt-3 text-sm font-bold text-indigo-950">هنوز فایلی ثبت نشده است</p>{!data.canUpload && <p className="mt-1 text-xs text-indigo-700">شما فقط اجازهٔ مشاهدهٔ پیوست‌ها را دارید.</p>}</div>}
          {data?.attachments.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.attachments.map((attachment) => <article key={attachment.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"><button type="button" onClick={() => setSelectedAttachment(attachment)} className="block w-full text-right"><div className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-100">{attachment.isImage ? <img src={attachmentUrl(attachment)} alt="" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-2 text-indigo-600"><FileIcon attachment={attachment} size={38} /><span className="text-xs font-bold">{fileKind(attachment)}</span></div>}<span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-950/65 px-2 py-1 text-[10px] font-bold text-white"><Eye size={12} />مشاهده</span></div><div className="p-3"><h3 className="truncate text-sm font-bold text-slate-900">{attachment.title || attachment.originalName}</h3><p className="mt-1 truncate text-[11px] text-slate-500">{attachment.originalName}</p><p className="mt-2 text-[11px] text-slate-600">{attachment.uploadedBy.name} · {byteSize(attachment.byteSize)}</p><p className="mt-0.5 text-[10px] text-slate-500">{dateTime(attachment.createdAt)}</p></div></button><div className="flex border-t border-slate-100 px-2 py-1.5"><a href={attachmentUrl(attachment)} download className="rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50">دانلود</a>{attachment.canDelete && <button type="button" disabled={busy} onClick={() => void remove(attachment)} className="mr-auto rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`حذف ${attachment.originalName}`}><Trash2 size={16} /></button>}</div></article>)}</div> : null}
        </div>
      </section>
    </div>}

    {selectedAttachment && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attachment-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAttachment(null); }}>
      <section dir="rtl" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="min-w-0"><p className="text-xs font-bold text-indigo-600">جزئیات پیوست</p><h2 id="attachment-preview-title" className="mt-1 truncate text-lg font-extrabold text-slate-950">{selectedAttachment.title || selectedAttachment.originalName}</h2></div><button type="button" onClick={() => setSelectedAttachment(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="بستن"><X size={20} /></button></header>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">{selectedAttachment.isImage ? <img src={attachmentUrl(selectedAttachment)} alt={selectedAttachment.title || selectedAttachment.originalName} className="max-h-[60vh] w-full object-contain" /> : isPdf(selectedAttachment) ? <iframe src={attachmentUrl(selectedAttachment)} title={selectedAttachment.originalName} className="h-[60vh] w-full bg-white" /> : <div className="p-8 text-center text-indigo-700"><FileIcon attachment={selectedAttachment} size={54} /><p className="mt-3 text-sm font-bold text-slate-800">پیش‌نمایش داخلی برای {fileKind(selectedAttachment)} در دسترس نیست.</p><p className="mt-1 text-xs text-slate-500">فایل را دانلود کنید تا با برنامهٔ مناسب باز شود.</p></div>}</div>
          <aside className="space-y-4"><div><p className="text-xs font-bold text-slate-500">نام فایل</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{selectedAttachment.originalName}</p></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="font-bold text-slate-500">نوع</p><p className="mt-1 text-slate-800">{fileKind(selectedAttachment)}</p></div><div><p className="font-bold text-slate-500">حجم</p><p className="mt-1 text-slate-800">{byteSize(selectedAttachment.byteSize)}</p></div></div><div><p className="text-xs font-bold text-slate-500">ارسال‌کننده</p><p className="mt-1 text-sm text-slate-800">{selectedAttachment.uploadedBy.name}</p></div><div><p className="text-xs font-bold text-slate-500">زمان ارسال</p><p className="mt-1 text-sm text-slate-800">{dateTime(selectedAttachment.createdAt)}</p></div>{selectedAttachment.description && <div><p className="text-xs font-bold text-slate-500">توضیحات</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedAttachment.description}</p></div>}<a href={attachmentUrl(selectedAttachment)} download className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><Download size={17} />دانلود فایل</a>{selectedAttachment.canDelete && <button type="button" disabled={busy} onClick={() => void remove(selectedAttachment)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={17} />حذف فایل</button>}</aside>
        </div>
      </section>
    </div>}
  </section>;
}
