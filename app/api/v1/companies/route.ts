import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(150),
  ownerId: z.uuid(),
}).strict();

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ message: "فقط مدیر اصلی می‌تواند شرکت ایجاد کند." }, { status: 403 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });

  const parsed = createCompanySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "اطلاعات شرکت معتبر نیست." }, { status: 400 });

  try {
    const company = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.findFirst({
        where: { id: parsed.data.ownerId, isActive: true },
        select: { id: true },
      });
      if (!owner) throw new Error("OWNER_NOT_FOUND");

      return tx.company.create({
        data: {
          name: parsed.data.name,
          members: { create: { userId: owner.id, role: "OWNER" } },
        },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          members: { where: { role: "OWNER", isActive: true }, select: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { members: true, projects: true } },
        },
      });
    });

    return NextResponse.json({ success: true, company, message: "شرکت ایجاد شد." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_NOT_FOUND") {
      return NextResponse.json({ message: "مالک انتخاب‌شده فعال نیست یا وجود ندارد." }, { status: 400 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ message: "شرکتی با این نام از قبل وجود دارد." }, { status: 409 });
    }
    console.error("Create company failed", error);
    return NextResponse.json({ message: "ایجاد شرکت ناموفق بود." }, { status: 500 });
  }
}
