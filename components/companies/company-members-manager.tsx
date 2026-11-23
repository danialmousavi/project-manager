"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Trash2, UserPlus } from "lucide-react";

type Role = "OWNER" | "ADMIN" | "PROJECT_MANAGER" | "EXPERT" | "CONTROLLER";
type Member = { id: string; role: Role; isActive: boolean; user: { id: string; name: string; email: string; phone: string | null; isActive: boolean } };
type Candidate = { id: string; name: string; email: string };
const labels: Record<Role, string> = { OWNER: "مالک شرکت", ADMIN: "مدیر شرکت", PROJECT_MANAGER: "مدیر پروژه", EXPERT: "کارشناس", CONTROLLER: "ناظر" };
const editableRoles: Exclude<Role, "OWNER">[] = ["ADMIN", "PROJECT_MANAGER", "EXPERT", "CONTROLLER"];
const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500";

export default function CompanyMembersManager({ companyId, initialMembers, canManageOwner }: { companyId: string; initialMembers: Member[]; canManageOwner: boolean }) {
  const [members, setMembers] = useState(initialMembers);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [role, setRole] = useState<Exclude<Role, "OWNER">>("EXPERT");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", phone: "", nationalId: "", role: "EXPERT" as Exclude<Role, "OWNER"> });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/companies/${companyId}/member-candidates?q=${encodeURIComponent(query.trim())}`, { credentials: "same-origin", signal: controller.signal });
        const data = await response.json();
        if (response.ok) setCandidates(data.users);
      } catch (err) { if (!(err instanceof DOMException && err.name === "AbortError")) setCandidates([]); }
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [companyId, query, selected]);

  async function request(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(path, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "عملیات ناموفق بود.");
    return data;
  }

  function appendMember(member: Member) {
    setMembers((items) => [...items.filter((item) => item.id !== member.id), member].sort((a, b) => a.user.name.localeCompare(b.user.name, "fa")));
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const data = await request(`/api/v1/companies/${companyId}/members`, "POST", { email: selected.email, role });
      appendMember(data.member); setQuery(""); setSelected(null); setRole("EXPERT"); setNotice("عضو به شرکت اضافه شد.");
    } catch (err) { setError(err instanceof Error ? err.message : "افزودن عضو ناموفق بود."); }
    finally { setSaving(false); }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const data = await request(`/api/v1/companies/${companyId}/members/create-user`, "POST", createForm);
      appendMember(data.member); setCreateForm({ name: "", email: "", password: "", phone: "", nationalId: "", role: "EXPERT" }); setCreateOpen(false); setNotice("کاربر جدید ساخته و به شرکت اضافه شد.");
    } catch (err) { setError(err instanceof Error ? err.message : "ایجاد کاربر ناموفق بود."); }
    finally { setSaving(false); }
  }

  async function updateMember(member: Member, changes: { role?: Exclude<Role, "OWNER">; isActive?: boolean }) {
    setBusy(member.id); setError(""); setNotice("");
    try { const data = await request(`/api/v1/companies/${companyId}/members/${member.id}`, "PATCH", changes); appendMember(data.member); setNotice("عضویت به‌روزرسانی شد."); }
    catch (err) { setError(err instanceof Error ? err.message : "ویرایش عضو ناموفق بود."); }
    finally { setBusy(null); }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`عضویت ${member.user.name} از این شرکت حذف شود؟`)) return;
    setBusy(member.id); setError(""); setNotice("");
    try { await request(`/api/v1/companies/${companyId}/members/${member.id}`, "DELETE"); setMembers((items) => items.filter((item) => item.id !== member.id)); setNotice("عضو از شرکت حذف شد."); }
    catch (err) { setError(err instanceof Error ? err.message : "حذف عضو ناموفق بود."); }
    finally { setBusy(null); }
  }

  return <div className="space-y-5">
    <form onSubmit={addMember} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_13rem_auto] md:items-end">
        <label className="relative"><span className="mb-1 block text-xs font-bold text-slate-700">جست‌وجوی کاربر موجود</span><input required value={selected ? `${selected.name} — ${selected.email}` : query} onChange={(event) => { setSelected(null); setQuery(event.target.value); }} placeholder="حداقل دو حرف از نام یا ایمیل" className={inputClass} />{!selected && query.trim().length >= 2 && candidates.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{candidates.map((user) => <button key={user.id} type="button" onClick={() => { setSelected(user); setCandidates([]); }} className="block w-full px-3 py-2 text-right text-sm hover:bg-emerald-50"><span className="font-bold">{user.name}</span><span dir="ltr" className="mr-2 text-xs text-slate-500">{user.email}</span></button>)}</div>}</label>
        <label><span className="mb-1 block text-xs font-bold text-slate-700">نقش در شرکت</span><select value={role} onChange={(event) => setRole(event.target.value as Exclude<Role, "OWNER">)} className={inputClass}>{editableRoles.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
        <button disabled={!selected || saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}افزودن عضو</button>
      </div>
      <button type="button" onClick={() => setCreateOpen((value) => !value)} className="mt-3 text-xs font-bold text-emerald-700 hover:underline">{createOpen ? "بستن ساخت کاربر" : "کاربر موردنظر وجود ندارد؟ ساخت کاربر جدید"}</button>
    </form>

    {createOpen && <form onSubmit={createUser} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"><label><span className="mb-1 block text-xs font-bold">نام و نام خانوادگی</span><input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} className={inputClass} /></label><label><span className="mb-1 block text-xs font-bold">ایمیل</span><input required type="email" dir="ltr" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} className={inputClass} /></label><label><span className="mb-1 block text-xs font-bold">رمز عبور اولیه</span><input required minLength={10} type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} className={inputClass} /></label><label><span className="mb-1 block text-xs font-bold">شماره موبایل</span><input required dir="ltr" value={createForm.phone} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} className={inputClass} /></label><label><span className="mb-1 block text-xs font-bold">کد ملی (اختیاری)</span><input dir="ltr" value={createForm.nationalId} onChange={(event) => setCreateForm({ ...createForm, nationalId: event.target.value })} className={inputClass} /></label><label><span className="mb-1 block text-xs font-bold">نقش در شرکت</span><select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as Exclude<Role, "OWNER"> })} className={inputClass}>{editableRoles.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label><button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-60 md:col-span-2">{saving && <LoaderCircle size={16} className="animate-spin" />}ساخت و افزودن کاربر</button></form>}

    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{error || notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-right text-sm"><thead className="bg-slate-50 text-xs text-[var(--muted)]"><tr><th className="px-5 py-3 font-bold">عضو</th><th className="px-5 py-3 font-bold">نقش</th><th className="px-5 py-3 font-bold">عضویت</th><th className="px-5 py-3 font-bold">عملیات</th></tr></thead><tbody className="divide-y divide-slate-100">{members.map((member) => { const locked = member.role === "OWNER" && !canManageOwner; const isBusy = busy === member.id; return <tr key={member.id}><td className="px-5 py-4"><p className="font-bold">{member.user.name}</p><p dir="ltr" className="mt-1 text-xs text-slate-500">{member.user.email}</p></td><td className="px-5 py-4"><select disabled={locked || isBusy} value={member.role} onChange={(event) => updateMember(member, { role: event.target.value as Exclude<Role, "OWNER"> })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:opacity-60">{member.role === "OWNER" && <option value="OWNER">{labels.OWNER}</option>}{editableRoles.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></td><td className="px-5 py-4"><button disabled={locked || isBusy} onClick={() => updateMember(member, { isActive: !member.isActive })} className={`rounded-full px-2 py-1 text-xs font-bold disabled:opacity-60 ${member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{member.isActive ? "فعال" : "غیرفعال"}</button></td><td className="px-5 py-4"><button disabled={locked || isBusy} onClick={() => removeMember(member)} className="inline-flex size-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`حذف ${member.user.name}`}><Trash2 size={16} /></button></td></tr>; })}</tbody></table></div></section>
  </div>;
}
