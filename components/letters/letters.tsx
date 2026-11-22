"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Inbox, Mail, Send, X } from "lucide-react";

type Letter = { replyToId: string | null; id: string; subject: string; body: string; createdAt: string; senderId: string; sender: { name: string }; recipients: { userId: string; readAt: string | null; user: { name: string } }[] };
type Data = { letters: Letter[]; members: { id: string; name: string }[]; actorId: string };

export default function Letters({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [selected, setSelected] = useState<Letter | null>(null);
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replySender, setReplySender] = useState<{ id: string; name: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/letters`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result);
      const letterId = window.location.hash.match(/^#letter-([0-9a-f-]{36})$/i)?.[1];
      if (letterId) { const target = result.letters.find((item: Letter) => item.id === letterId); if (target) { setFolder(target.senderId === result.actorId ? "sent" : "inbox"); setSelected(target); } }
    } catch (e) { setError(e instanceof Error ? e.message : "دریافت نامه‌ها ناموفق بود."); }
  }, [projectId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const openLinkedLetter = () => { void load(); };
    window.addEventListener("hashchange", openLinkedLetter);
    return () => window.removeEventListener("hashchange", openLinkedLetter);
  }, [load]);
  useEffect(() => {
    const recipient = selected?.recipients.find((item) => item.userId === data?.actorId);
    if (!selected || !recipient || recipient.readAt) return;
    const letterId = selected.id;
    const actorId = recipient.userId;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/projects/${projectId}/letters`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ letterId }) });
        if (!response.ok) throw new Error("ثبت وضعیت خوانده‌شدن ناموفق بود.");
        if (cancelled) return;
        const readAt = new Date().toISOString();
        const mark = (letter: Letter): Letter => letter.id !== letterId ? letter : { ...letter, recipients: letter.recipients.map((item) => item.userId === actorId ? { ...item, readAt } : item) };
        setData((current) => current ? { ...current, letters: current.letters.map(mark) } : current);
        setSelected((current) => current ? mark(current) : current);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "ثبت وضعیت خوانده‌شدن ناموفق بود."); }
    })();
    return () => { cancelled = true; };
  }, [selected, data?.actorId, projectId]);
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/letters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body, recipients, ...(replyToId ? { replyToId } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSubject(""); setBody(""); setRecipients([]); setReplyToId(null); setReplySender(null); setCompose(false); setFolder("sent"); window.history.replaceState(null, "", window.location.pathname); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "ارسال نامه ناموفق بود."); } finally { setBusy(false); }
  }
  const unreadCount = data?.letters.filter((letter) => letter.recipients.some((r) => r.userId === data.actorId && !r.readAt)).length ?? 0;
  const letters = data?.letters.filter((letter) => folder === "sent" ? letter.senderId === data.actorId : letter.recipients.some((r) => r.userId === data.actorId)) ?? [];
  return <div dir="rtl" className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><Mail className="text-emerald-600" />نامه‌نگاری پروژه</h1><p className="mt-2 text-sm text-slate-500">نامه‌ها فقط برای فرستنده و گیرندگان انتخاب‌شده قابل مشاهده‌اند.</p></div><button onClick={() => { setCompose(true); setSelected(null); setSubject(""); setBody(""); setRecipients([]); setReplyToId(null); setReplySender(null); setError(""); }} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">نامه جدید</button></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]"><aside className="rounded-2xl border border-slate-200 bg-white p-2">{([["inbox", "دریافتی", Inbox], ["sent", "ارسالی", Send]] as const).map(([key, label, Icon]) => <button key={key} onClick={() => { setFolder(key); setSelected(null); setCompose(false); }} className={`flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${folder === key ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={17} />{label}{key === "inbox" && unreadCount > 0 && <span className="mr-auto rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">{unreadCount.toLocaleString("fa-IR")}</span>}</button>)}</aside>
    <section className="min-h-80 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">{compose ? <form onSubmit={send} className="space-y-4"><div className="flex justify-between"><h2 className="font-bold">نوشتن نامه</h2><button type="button" onClick={() => setCompose(false)} aria-label="بستن"><X size={20} /></button></div><fieldset><legend className="mb-2 text-sm font-bold">گیرندگان</legend><div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">{[...(data?.members ?? []), ...(replySender && !data?.members.some((m) => m.id === replySender.id) ? [replySender] : [])].map((member) => <label key={member.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={recipients.includes(member.id)} onChange={(e) => setRecipients(e.target.checked ? [...recipients, member.id] : recipients.filter((id) => id !== member.id))} />{member.name}</label>)}{data?.members.length === 0 && <p className="text-sm text-slate-500">عضو دیگری برای دریافت نامه وجود ندارد.</p>}</div></fieldset><label className="block text-sm font-bold">موضوع<input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label><label className="block text-sm font-bold">متن نامه<textarea required maxLength={20000} rows={9} value={body} onChange={(e) => setBody(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label><button disabled={busy || !recipients.length} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "در حال ارسال..." : "ارسال نامه"}</button></form> : selected ? <article><button onClick={() => setSelected(null)} className="text-sm font-bold text-emerald-700">بازگشت به نامه‌ها</button><h2 className="mt-5 text-lg font-extrabold">{selected.subject}</h2><p className="mt-3 text-xs leading-6 text-slate-500">از: {selected.sender.name} · به: {selected.recipients.map((r) => r.user.name).join("، ")} · {new Date(selected.createdAt).toLocaleString("fa-IR")}</p><p className="mt-6 whitespace-pre-wrap break-words border-t border-slate-100 pt-5 text-sm leading-8 text-slate-700">{selected.body}</p>{selected.senderId !== data?.actorId && <button type="button" onClick={() => { setReplyToId(selected.id); setReplySender({ id: selected.senderId, name: selected.sender.name }); setRecipients([selected.senderId]); setSubject(selected.subject.startsWith("پاسخ: ") ? selected.subject : `پاسخ: ${selected.subject}`.slice(0, 200)); setBody(""); setError(""); setCompose(true); }} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Send size={16} />پاسخ به نامه</button>}</article> : <><h2 className="mb-4 font-bold">{folder === "inbox" ? "نامه‌های دریافتی" : "نامه‌های ارسالی"}</h2>{!data ? <p className="text-sm text-slate-500">در حال دریافت نامه‌ها...</p> : letters.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">نامه‌ای در این بخش وجود ندارد.</p> : <div className="divide-y divide-slate-100">{letters.map((letter) => <button key={letter.id} onClick={() => setSelected(letter)} className="flex w-full flex-wrap items-center justify-between gap-2 px-2 py-4 text-right hover:bg-slate-50"><span><strong className="block text-sm text-slate-800">{letter.subject}{folder === "inbox" && <span className="mr-2 rounded-full bg-emerald-100 px-2 py-1 text-[10px] text-emerald-700">{letter.recipients.some((r) => r.userId === data?.actorId && !r.readAt) ? "خوانده‌نشده" : "خوانده‌شده"}</span>}</strong><span className="mt-1 block text-xs text-slate-500">{folder === "inbox" ? `از: ${letter.sender.name}` : `به: ${letter.recipients.map((r) => r.user.name).join("، ")}`}</span></span><span className="text-xs text-slate-400">{new Date(letter.createdAt).toLocaleDateString("fa-IR")}</span></button>)}</div>}</>}</section></div></div>;
}
