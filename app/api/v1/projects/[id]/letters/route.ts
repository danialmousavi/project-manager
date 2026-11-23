import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskProjectAccess } from "@/lib/task-access";
import { isAllowedOrigin } from "@/lib/security/origin";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20000), recipients: z.array(z.uuid()).min(1).max(30), replyToId: z.uuid().optional() }).strict();
const fail = (message: string, status: number) => NextResponse.json({ message }, { status });

async function authorize(context: Context) {
  const actor = await getCurrentUser();
  const { id } = await context.params;
  if (!actor || !z.uuid().safeParse(id).success) return { actor, id, access: null };
  return { actor, id, access: await getTaskProjectAccess(actor, id) };
}

export async function GET(_request: NextRequest, context: Context) {
  const { actor, id, access } = await authorize(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!access) return fail("دسترسی به پروژه مجاز نیست.", 403);
  const canViewAll = access.canViewAllTasks;
  const [letters, members] = await Promise.all([
    prisma.letter.findMany({ where: { projectId: id, ...(canViewAll ? {} : { OR: [{ senderId: actor.id }, { recipients: { some: { userId: actor.id } } }] }) }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, subject: true, body: true, createdAt: true, replyToId: true, senderId: true, sender: { select: { name: true } }, recipients: { select: { userId: true, readAt: true, user: { select: { name: true } } } } } }),
    prisma.projectMember.findMany({ where: { projectId: id, userId: { not: actor.id }, user: { isActive: true } }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  return NextResponse.json({ letters, members: members.map((m) => m.user), actorId: actor.id, canViewAll, canSend: !access.isProjectController }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: Context) {
  const { actor, id, access } = await authorize(context);
  if (access?.isProjectController) return fail("Project controller is read-only.", 403);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!access) return fail("دسترسی به پروژه مجاز نیست.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("موضوع، متن و گیرندگان معتبر را وارد کنید.", 400);
  const ids = [...new Set(parsed.data.recipients)];
  if (ids.includes(actor.id)) return fail("فرستنده نمی‌تواند گیرنده باشد.", 400);
  const parent = parsed.data.replyToId ? await prisma.letter.findFirst({ where: { id: parsed.data.replyToId, projectId: id, OR: [{ senderId: actor.id }, { recipients: { some: { userId: actor.id } } }] }, select: { senderId: true, sender: { select: { role: true, isActive: true } } } }) : null;
  if (parsed.data.replyToId && !parent) return fail("نامه اصلی در دسترس نیست.", 404);
  const specialSender = parent?.sender.isActive && parent.sender.role === "ADMIN" ? parent.senderId : null;
  const memberIds = ids.filter((userId) => userId !== specialSender);
  const count = await prisma.projectMember.count({ where: { projectId: id, userId: { in: memberIds }, user: { isActive: true } } });
  if (count !== memberIds.length) return fail("گیرندگان باید اعضای فعال پروژه باشند.", 400);
  await prisma.$transaction(async (tx) => {
    const letter = await tx.letter.create({ data: { projectId: id, senderId: actor.id, subject: parsed.data.subject, body: parsed.data.body, replyToId: parent ? parsed.data.replyToId : undefined, recipients: { create: ids.map((userId) => ({ userId })) } } });
    await tx.notification.createMany({ data: ids.map((userId) => ({ userId, projectId: id, type: "LETTER_RECEIVED" as const, title: parent ? "پاسخ نامه جدید" : "نامه جدید", body: `${actor.name} نامه‌ای برای شما فرستاد.`, href: `/projects/${id}/letters#letter-${letter.id}` })) });
  });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { actor, id, access } = await authorize(context);
  if (!actor) return fail("ابتدا وارد حساب شوید.", 401);
  if (!access) return fail("دسترسی به پروژه مجاز نیست.", 403);
  if (!isAllowedOrigin(request)) return fail("درخواست نامعتبر است.", 403);
  const parsed = z.object({ letterId: z.uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("شناسه نامه معتبر نیست.", 400);
  const recipient = await prisma.letterRecipient.findFirst({ where: { letterId: parsed.data.letterId, userId: actor.id, letter: { projectId: id } }, select: { readAt: true } });
  if (!recipient) return fail("نامه دریافتی پیدا نشد.", 404);
  if (!recipient.readAt) await prisma.letterRecipient.updateMany({ where: { letterId: parsed.data.letterId, userId: actor.id, readAt: null, letter: { projectId: id } }, data: { readAt: new Date() } });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
