
import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
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

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(128),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  nationalId: z.string().transform(normalizeNationalId)
    .refine(isValidNationalId, "کد ملی معتبر نیست"),
  phone: z.string().transform(normalizePhone)
    .refine(isValidIranianMobile, "شماره موبایل معتبر نیست"),
});

export async function POST(request: NextRequest) {
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

  try {
    const { name, email, password, role, nationalId, phone } =
      parsed.data;

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        nationalId,
        phone,
        passwordHash,
        role,
      },
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

    return NextResponse.json(
      {
        success: true,
        message: "کاربر ایجاد شد",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
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
