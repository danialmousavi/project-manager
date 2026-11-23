import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canManageCompany, getCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const roleSchema = z.enum(["ADMIN", "PROJECT_MANAGER", "EXPERT", "CONTROLLER"]);
const updateMemberSchema = z.object({ role: roleSchema.optional(), isActive: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, "اطلاعاتی برای ویرایش ارسال نشده است.");
type Context = { params: Promise<{ id: string; memberId: string }> };

async function getTarget(companyId: string, memberId: string) {
  return prisma.companyMember.findFirst({ where: { id: memberId, companyId }, select: { id: true, userId: true, role: true, isActive: true, company: { select: { status: true } } } });
}

async function wouldLeaveNoOwner(companyId: string, target: { role: string; isActive: boolean }, nextActive: boolean, nextRole: string) {
  if (target.role !== "OWNER" || !target.isActive || (nextActive && nextRole === "OWNER")) return false;
  return (await prisma.companyMember.count({ where: { companyId, role: "OWNER", isActive: true } })) <= 1;
}

async function authorize(actor: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, companyId: string) {
  const access = await getCompanyAccess(actor, companyId);
  if (!access) return { error: NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 }) };
  if (!canManageCompany(access)) return { error: NextResponse.json({ message: "اجازه مدیریت اعضای شرکت را ندارید." }, { status: 403 }) };
  return { access };
}

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  const { id, memberId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(memberId).success) return NextResponse.json({ message: "شناسه نامعتبر است." }, { status: 400 });
  const parsed = updateMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "اطلاعات عضو معتبر نیست." }, { status: 400 });
  const permitted = await authorize(actor, id);
  if ("error" in permitted) return permitted.error;
  const target = await getTarget(id, memberId);
  if (!target) return NextResponse.json({ message: "عضو پیدا نشد." }, { status: 404 });
  if (target.company.status !== "ACTIVE") return NextResponse.json({ message: "شرکت تعلیق‌شده است." }, { status: 409 });
  if (target.role === "OWNER" && !permitted.access.isPlatformAdmin) return NextResponse.json({ message: "ویرایش مالک شرکت فقط برای مدیر اصلی ممکن است." }, { status: 403 });
  const nextRole = parsed.data.role ?? target.role;
  const nextActive = parsed.data.isActive ?? target.isActive;
  if (await wouldLeaveNoOwner(id, target, nextActive, nextRole)) return NextResponse.json({ message: "شرکت باید حداقل یک مالک فعال داشته باشد." }, { status: 409 });

  const member = await prisma.companyMember.update({ where: { id: memberId }, data: { role: parsed.data.role, isActive: parsed.data.isActive }, select: { id: true, role: true, isActive: true, joinedAt: true, user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } } });
  return NextResponse.json({ success: true, member, message: "عضویت شرکت به‌روزرسانی شد." });
}

export async function DELETE(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  const { id, memberId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(memberId).success) return NextResponse.json({ message: "شناسه نامعتبر است." }, { status: 400 });
  const permitted = await authorize(actor, id);
  if ("error" in permitted) return permitted.error;
  const target = await getTarget(id, memberId);
  if (!target) return NextResponse.json({ message: "عضو پیدا نشد." }, { status: 404 });
  if (target.company.status !== "ACTIVE") return NextResponse.json({ message: "شرکت تعلیق‌شده است." }, { status: 409 });
  if (target.role === "OWNER" && !permitted.access.isPlatformAdmin) return NextResponse.json({ message: "حذف مالک شرکت فقط برای مدیر اصلی ممکن است." }, { status: 403 });
  if (await wouldLeaveNoOwner(id, target, false, target.role)) return NextResponse.json({ message: "شرکت باید حداقل یک مالک فعال داشته باشد." }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.deleteMany({ where: { userId: target.userId, project: { companyId: id } } });
    await tx.companyMember.delete({ where: { id: target.id } });
  });
  return NextResponse.json({ success: true, message: "عضو از شرکت حذف شد." });
}
