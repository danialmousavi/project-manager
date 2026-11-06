
import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(128),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
});

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب خود شوید" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { message: "شما اجازه مدیریت کاربران را ندارید" },
      { status: 403 }
    );
  }

  const origin = request.headers.get("origin");

  if (!origin || origin !== request.nextUrl.origin) {
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
          "اطلاعات نامعتبر است. رمز عبور باید حداقل ۱۰ کاراکتر باشد.",
      },
      { status: 400 }
    );
  }

  const { name, email, password, role } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "این ایمیل قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "کاربر با موفقیت ایجاد شد",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    // Handles concurrent requests using the same email.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "این ایمیل قبلاً ثبت شده است" },
        { status: 409 }
      );
    }

    console.error("Create user failed:", error);

    return NextResponse.json(
      { message: "خطا در ایجاد کاربر" },
      { status: 500 }
    );
  }
}
