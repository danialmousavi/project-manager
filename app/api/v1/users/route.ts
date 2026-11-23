
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isValidIranianMobile,
  isValidNationalId,
  normalizeNationalId,
  normalizePhone,
} from "@/lib/iranian-identity";
import { isAllowedOrigin } from "@/lib/security/origin";
import { hashPassword } from "@/lib/password";
import { canManageCompany, getCompanyAccess } from "@/lib/company-access";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(128),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  companyId: z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional()),
  companyRole: z.enum(["ADMIN", "PROJECT_MANAGER", "EXPERT", "CONTROLLER"]).optional(),
  nationalId: z.string().trim().transform(normalizeNationalId)
    .refine((value) => value === "" || isValidNationalId(value), "کد ملی معتبر نیست")
    .optional(),
  phone: z.string().transform(normalizePhone)
    .refine(isValidIranianMobile, "شماره موبایل معتبر نیست"),
}).superRefine((value, context) => {
  if (value.companyId && !value.companyRole) context.addIssue({ code: "custom", message: "نقش شرکتی الزامی است." });
  if (!value.companyId && value.companyRole) context.addIssue({ code: "custom", message: "نقش شرکتی بدون انتخاب شرکت معتبر نیست." });
  if (value.role === "ADMIN" && (value.companyId || value.companyRole)) context.addIssue({ code: "custom", message: "مدیر اصلی به شرکت وابسته نیست." });
});

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ||
          "اطلاعات کاربر معتبر نیست",
      },
      { status: 400 }
    );
  }

  if (currentUser.role !== "ADMIN") {
    if (!parsed.data.companyId || parsed.data.role === "ADMIN") return NextResponse.json({ message: "کاربر باید در یکی از شرکت‌های شما ایجاد شود." }, { status: 403 });
    const access = await getCompanyAccess(currentUser, parsed.data.companyId);
    if (!access || !canManageCompany(access)) return NextResponse.json({ message: "دسترسی مدیریت این شرکت را ندارید." }, { status: 403 });
  }

  try {
    const { name, email, password, role, companyId, companyRole, nationalId, phone } =
      parsed.data;

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      if (companyId) {
        const company = await tx.company.findFirst({ where: { id: companyId, status: "ACTIVE" }, select: { id: true } });
        if (!company) throw new Error("COMPANY_NOT_FOUND");
      }
      return tx.user.create({ data: {
        name,
        email,
        nationalId: nationalId || null,
        phone,
        passwordHash,
        role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
        ...(companyId && companyRole ? { companyMemberships: { create: { companyId, role: companyRole } } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        nationalId: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true, companyMemberships: { select: { role: true, isActive: true, company: { select: { id: true, name: true, status: true } } } },
      },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "کاربر ایجاد شد",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") return NextResponse.json({ message: "شرکت انتخاب‌شده فعال نیست یا وجود ندارد." }, { status: 400 });
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "ایمیل، کد ملی یا شماره موبایل قبلاً ثبت شده است",
        },
        { status: 409 }
      );
    }

    console.error("Create user failed");

    return NextResponse.json(
      { message: "خطا در ایجاد کاربر" },
      { status: 500 }
    );
  }
}
