"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, ImageIcon, LoaderCircle, Paperclip, Trash2, X } from "lucide-react";

type Attachment = { id: string; originalName: string; title: string | null; description: string | null; byteSize: number; createdAt: string; uploadedBy: { id: string; name: string }; canDelete: boolean; isImage: boolean };
type AttachmentsResponse = { attachments: Attachment[] };

function byteSize(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024).toLocaleString("fa-IR")} کیلوبایت`
    : `${(value / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "خطایی رخ داد.";
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return { message: `پاسخ خالی از سرور دریافت شد (کد ${response.status}).` };
  if (!response.headers.get("content-type")?.includes("application/json")) return { message: `پاسخ نامعتبر از سرور دریافت شد (کد ${response.status}).` };
  try { return JSON.parse(text) as { message?: string; attachments?: Attachment[] }; }
  catch { return { message: `پاسخ نامعتبر از سرور دریافت شد (کد ${response.status}).` }; }
}

export default function TaskAttachments({ taskId }: { taskId: string }) {
  const [data, setData] = useState<AttachmentsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/tasks/${taskId}/attachments`, { cache: "no-store", credentials: "same-origin" });
    const body = await responseBody(response);
    if (!response.ok) throw new Error(body.message || "دریافت پیوست‌ها ناموفق بود.");
    setData({ attachments: body.attachments ?? [] });
  }, [taskId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((cause) => setError(errorMessage(cause))); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/task-attachments/${id}`, { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.message || "حذف پیوست ناموفق بود.");
      await load();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  const count = data?.attachments.length ?? 0;

  return <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h5 className="flex items-center gap-1.5 text-xs font-bold text-indigo-900"><Paperclip size={15} />فایل‌ها و مستندات</h5><p className="mt-1 text-[11px] text-indigo-700">{count === 0 ? "هنوز فایلی ثبت نشده است." : `${count.toLocaleString("fa-IR")} فایل به این تسک پیوست شده است.`}</p></div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">مشاهده و مدیریت فایل‌ها</button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attachments-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section dir="rtl" className="w-full max-w-3xl overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 bg-gradient-to-l from-indigo-700 to-violet-700 px-5 py-4 text-white"><div><p className="text-[11px] font-bold text-indigo-100">پیوست‌های وظیفه</p><h2 id="attachments-title" className="mt-1 text-lg font-extrabold">فایل‌ها و مستندات</h2><p className="mt-1 text-xs text-indigo-100">{count.toLocaleString("fa-IR")} فایل ثبت شده</p></div><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg p-2 text-indigo-100 hover:bg-white/15 hover:text-white disabled:opacity-50" aria-label="بستن"><X size={20} /></button></header>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {!data && <div className="flex justify-center py-10"><LoaderCircle size={22} className="animate-spin text-indigo-600" /></div>}
          {data?.attachments.length === 0 && <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-10 text-center"><Paperclip className="mx-auto text-indigo-500" size={27} /><p className="mt-3 text-sm font-bold text-indigo-950">هنوز فایلی ثبت نشده است</p><p className="mt-1 text-xs text-indigo-700">بارگذاری فایل در مرحلهٔ بعدی به این پنجره افزوده می‌شود.</p></div>}
          {data?.attachments.map((attachment) => <article key={attachment.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"><a href={`/api/v1/task-attachments/${attachment.id}/download`} target="_blank" rel="noreferrer" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700" aria-label={`باز کردن ${attachment.originalName}`}>{attachment.isImage ? <ImageIcon size={20} /> : <FileText size={20} />}</a><div className="min-w-0 flex-1"><a href={`/api/v1/task-attachments/${attachment.id}/download`} target="_blank" rel="noreferrer" className="block truncate text-sm font-bold text-slate-900 hover:text-indigo-700">{attachment.title || attachment.originalName}</a>{attachment.description && <p className="mt-1 text-xs text-slate-600">{attachment.description}</p>}<p className="mt-1.5 text-[11px] text-slate-500">{attachment.uploadedBy.name} · {byteSize(attachment.byteSize)} · {new Date(attachment.createdAt).toLocaleDateString("fa-IR")}</p></div><div className="flex items-center gap-1"><a href={`/api/v1/task-attachments/${attachment.id}/download`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-100" aria-label={`دانلود ${attachment.originalName}`}><Download size={17} /></a>{attachment.canDelete && <button type="button" disabled={busy} onClick={() => void remove(attachment.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`حذف ${attachment.originalName}`}><Trash2 size={17} /></button>}</div></article>)}
        </div>
      </section>
    </div>}
  </section>;
}
