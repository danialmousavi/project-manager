import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  ownerId: z.uuid().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "اطلاعاتی برای ویرایش ارسال نشده است.");

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ message: "فقط مدیر اصلی می‌تواند شرکت را ویرایش کند." }, { status: 403 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه شرکت نامعتبر است." }, { status: 400 });
  const parsed = updateCompanySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "اطلاعات شرکت معتبر نیست." }, { status: 400 });

  try {
    const company = await prisma.$transaction(async (tx) => {
      const existing = await tx.company.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new Error("COMPANY_NOT_FOUND");

      if (parsed.data.ownerId) {
        const owner = await tx.user.findFirst({ where: { id: parsed.data.ownerId, isActive: true }, select: { id: true } });
        if (!owner) throw new Error("OWNER_NOT_FOUND");
        await tx.companyMember.updateMany({ where: { companyId: id, role: "OWNER" }, data: { role: "ADMIN" } });
        await tx.companyMember.upsert({
          where: { companyId_userId: { companyId: id, userId: owner.id } },
          update: { role: "OWNER", isActive: true },
          create: { companyId: id, userId: owner.id, role: "OWNER" },
        });
      }

      return tx.company.update({
        where: { id },
        data: { name: parsed.data.name, status: parsed.data.status },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          members: { where: { role: "OWNER", isActive: true }, select: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { members: true, projects: { where: { archivedAt: null } } } },
        },
      });
    });
    return NextResponse.json({ success: true, company, message: "اطلاعات شرکت ذخیره شد." });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
    if (error instanceof Error && error.message === "OWNER_NOT_FOUND") return NextResponse.json({ message: "مالک انتخاب‌شده فعال نیست یا وجود ندارد." }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ message: "شرکتی با این نام از قبل وجود دارد." }, { status: 409 });
    console.error("Update company failed", error);
    return NextResponse.json({ message: "ویرایش شرکت ناموفق بود." }, { status: 500 });
  }
}
