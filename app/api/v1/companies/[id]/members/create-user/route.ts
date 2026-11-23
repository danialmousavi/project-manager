import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canManageCompany, getCompanyAccess } from "@/lib/company-access";
import { normalizeNationalId, normalizePhone, isValidIranianMobile, isValidNationalId } from "@/lib/iranian-identity";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isAllowedOrigin } from "@/lib/security/origin";

const roleSchema = z.enum(["ADMIN", "PROJECT_MANAGER", "EXPERT", "CONTROLLER"]);
const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(128),
  role: roleSchema,
  nationalId: z.string().trim().transform(normalizeNationalId).refine((value) => value === "" || isValidNationalId(value), "کد ملی معتبر نیست").optional(),
  phone: z.string().transform(normalizePhone).refine(isValidIranianMobile, "شماره موبایل معتبر نیست"),
}).strict();
type Context = { params: Promise<{ id: string }> };

const legacyRole = { ADMIN: "MANAGER", PROJECT_MANAGER: "MANAGER", EXPERT: "EMPLOYEE", CONTROLLER: "CONTROLLER" } as const;

export async function POST(request: NextRequest, context: Context) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "ابتدا وارد حساب شوید." }, { status: 401 });
  if (!isAllowedOrigin(request)) return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 403 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "شناسه شرکت نامعتبر است." }, { status: 400 });
  const access = await getCompanyAccess(actor, id);
  if (!access) return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
  if (!canManageCompany(access)) return NextResponse.json({ message: "اجازه ایجاد کاربر را ندارید." }, { status: 403 });
  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "اطلاعات کاربر معتبر نیست." }, { status: 400 });

  try {
    const member = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id }, select: { status: true } });
      if (!company) throw new Error("COMPANY_NOT_FOUND");
      if (company.status !== "ACTIVE") throw new Error("COMPANY_SUSPENDED");
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash: await hashPassword(parsed.data.password),
          role: legacyRole[parsed.data.role],
          nationalId: parsed.data.nationalId || null,
          phone: parsed.data.phone,
        },
      });
      return tx.companyMember.create({
        data: { companyId: id, userId: user.id, role: parsed.data.role },
        select: { id: true, role: true, isActive: true, joinedAt: true, user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
      });
    });
    return NextResponse.json({ success: true, member, message: "کاربر و عضویت شرکت ایجاد شد." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") return NextResponse.json({ message: "شرکت پیدا نشد." }, { status: 404 });
    if (error instanceof Error && error.message === "COMPANY_SUSPENDED") return NextResponse.json({ message: "شرکت تعلیق‌شده است." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ message: "ایمیل، کد ملی یا شماره موبایل قبلاً ثبت شده است." }, { status: 409 });
    console.error("Create company user failed", error);
    return NextResponse.json({ message: "ایجاد کاربر ناموفق بود." }, { status: 500 });
  }
}
