
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

const updateSchema = z
  .object({
    role: z.enum(["MANAGER", "EMPLOYEE", "CONTROLLER"]).optional(),
    isActive: z.boolean().optional(),
    nationalId: z.string().trim()
      .transform(normalizeNationalId)
      .refine((value) => value === "" || isValidNationalId(value), "کد ملی معتبر نیست")
      .optional(),
    phone: z.string()
      .transform(normalizePhone)
      .refine(isValidIranianMobile, "شماره موبایل معتبر نیست")
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "اطلاعاتی برای ویرایش ارسال نشده است"
  );

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب شوید" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { message: "دسترسی غیرمجاز" },
      { status: 403 }
    );
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "شناسه کاربر نامعتبر است" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ||
          "اطلاعات نامعتبر است",
      },
      { status: 400 }
    );
  }

  const changes = parsed.data;
  const editingSelf = id === currentUser.id;

  if (
    editingSelf &&
    (changes.role !== undefined ||
      changes.isActive !== undefined)
  ) {
    return NextResponse.json(
      { message: "نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید" },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "کاربر پیدا نشد" },
        { status: 404 }
      );
    }

    if (
      existing.role === "ADMIN" &&
      (changes.role !== undefined ||
        changes.isActive !== undefined)
    ) {
      return NextResponse.json(
        { message: "تغییر نقش یا وضعیت مدیر اصلی مجاز نیست" },
        { status: 403 }
      );
    }

    const identityOnly = {
      nationalId: changes.nationalId === undefined
        ? undefined
        : changes.nationalId || null,
      phone: changes.phone,
    };

    const result = await prisma.user.updateMany({
      where: {
        id,
        ...(changes.role !== undefined ||
        changes.isActive !== undefined
          ? { role: { not: "ADMIN" as const } }
          : {}),
      },
      data:
        editingSelf || existing.role === "ADMIN"
          ? identityOnly
          : changes,
    });

    if (result.count === 0) {
      return NextResponse.json(
        { message: "ویرایش این کاربر مجاز نیست" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        nationalId: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "اطلاعات کاربر ذخیره شد",
      user,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "کد ملی یا شماره موبایل تکراری است" },
        { status: 409 }
      );
    }

    console.error("Update user failed");

    return NextResponse.json(
      { message: "خطا در ذخیره اطلاعات کاربر" },
      { status: 500 }
    );
  }
}
