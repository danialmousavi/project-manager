
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateUserSchema = z
  .object({
    role: z.enum(["MANAGER", "EMPLOYEE"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.role !== undefined ||
      value.isActive !== undefined,
    { message: "هیچ تغییری ارسال نشده است" }
  );

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      { message: "ابتدا وارد حساب خود شوید" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { message: "دسترسی غیرمجاز" },
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

  const { id } = await context.params;
  const parsedId = z.uuid().safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { message: "شناسه کاربر نامعتبر است" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "اطلاعات ارسال‌شده نامعتبر است" },
      { status: 400 }
    );
  }

  if (id === currentUser.id) {
    return NextResponse.json(
      { message: "نمی‌توانید دسترسی حساب خودتان را تغییر دهید" },
      { status: 403 }
    );
  }

  try {
    // The conditional update also protects ADMIN users
    // against concurrent role changes.
    const result = await prisma.user.updateMany({
      where: {
        id,
        role: { not: "ADMIN" },
      },
      data: parsed.data,
    });

    if (result.count === 0) {
      return NextResponse.json(
        {
          message:
            "کاربر یافت نشد یا تغییر حساب مدیر اصلی مجاز نیست",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "اطلاعات کاربر به‌روزرسانی شد",
    });
  } catch (error) {
    console.error("Update user failed:", error);

    return NextResponse.json(
      { message: "خطا در به‌روزرسانی کاربر" },
      { status: 500 }
    );
  }
}
