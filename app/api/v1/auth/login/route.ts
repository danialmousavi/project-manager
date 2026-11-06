
import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  createSession,
  getSessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(1024),
});

export async function POST(request: NextRequest) {
  // Only accept requests from the same origin.
  if (
    !request.headers.get("origin") ||
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "درخواست نامعتبر است" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "ایمیل یا رمز عبور نامعتبر است" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { message: "ایمیل یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    const isValid = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!isValid) {
      return NextResponse.json(
        { message: "ایمیل یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    const token = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      message: "ورود موفقیت‌آمیز بود",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(
      getSessionCookieName(),
      token,
      sessionCookieOptions
    );

    return response;
  } catch {
    return NextResponse.json(
      { message: "خطایی در ورود رخ داد" },
      { status: 500 }
    );
  }
}
