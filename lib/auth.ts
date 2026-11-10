
import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { shouldUseSecureSessionCookie } from "@/lib/session-cookie";

const COOKIE_NAME = "pm_session";
const SESSION_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export const sessionCookieOptions = {
  httpOnly: true,
  // An explicit setting wins. Otherwise an HTTP APP_URL keeps the cookie
  // usable on deployments that do not terminate TLS.
  secure: shouldUseSecureSessionCookie(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return token;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  return session.user;
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  cookieStore.delete(COOKIE_NAME);
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
