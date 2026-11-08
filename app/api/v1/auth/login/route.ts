
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  createSession,
  getSessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  recordLoginResult,
  trustedClientIp,
} from "@/lib/login-rate-limit";
import { isAllowedOrigin } from "@/lib/security/origin";
import { verifyPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(1024),
});

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$w/g2rYHwgN6KOhxPbHf3FQ$IPtVxYlJWVrDlu03i3QgrPtCqVnSVySC1KAxqAj3llQ";

export async function POST(request: NextRequest) {
  // Only accept requests from the same origin.
  if (!isAllowedOrigin(request)) {
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
    const ip = trustedClientIp(request);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    const isValid = await verifyPassword(
      user?.isActive
        ? user.passwordHash
        : DUMMY_PASSWORD_HASH,
      password
    );

    const limit = await recordLoginResult({
      email,
      ip,
      succeeded: Boolean(user?.isActive && isValid),
    });

    if (limit.limited) {
      return NextResponse.json(
        { message: "تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (!user || !user.isActive || !isValid) {
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
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { message: "خطایی در ورود رخ داد" },
      { status: 500 }
    );
  }
}
