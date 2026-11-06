import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 30;

type ScopeKey = {
  scope: "ACCOUNT" | "IP";
  keyHash: string;
  limit: number;
};

type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

function secret() {
  const configured = process.env.LOGIN_RATE_LIMIT_SECRET;

  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("LOGIN_RATE_LIMIT_SECRET is required in production");
  }

  return "development-only-login-rate-limit-secret";
}

function hash(scope: string, value: string) {
  return createHmac("sha256", secret())
    .update(`${scope}:${value}`)
    .digest("hex");
}

export function trustedClientIp(request: Request): string | null {
  const headerName = process.env.TRUST_PROXY_IP_HEADER?.trim();

  if (!headerName) return null;

  const candidate = request.headers
    .get(headerName)
    ?.split(",")[0]
    ?.trim();

  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

function scopeKeys(email: string, ip: string | null): ScopeKey[] {
  return [
    {
      scope: "ACCOUNT",
      keyHash: hash("account", email),
      limit: ACCOUNT_LIMIT,
    },
    ...(ip
      ? [{
          scope: "IP" as const,
          keyHash: hash("ip", ip),
          limit: IP_LIMIT,
        }]
      : []),
  ];
}

async function lockKeys(
  tx: Prisma.TransactionClient,
  keys: readonly ScopeKey[]
) {
  for (const key of [...keys].sort((a, b) =>
    a.keyHash.localeCompare(b.keyHash)
  )) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${key.keyHash}))
    `;
  }
}

async function inspectLockedAttempts(
  tx: Prisma.TransactionClient,
  keys: readonly ScopeKey[],
  now: Date
): Promise<RateLimitResult> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  await tx.loginAttempt.deleteMany({
    where: {
      OR: keys.map((key) => ({
        scope: key.scope,
        keyHash: key.keyHash,
        attemptedAt: { lt: windowStart },
      })),
    },
  });

  const attempts = await tx.loginAttempt.findMany({
    where: {
      attemptedAt: { gte: windowStart },
      OR: keys.map((key) => ({
        scope: key.scope,
        keyHash: key.keyHash,
      })),
    },
    select: {
      scope: true,
      keyHash: true,
      attemptedAt: true,
    },
  });

  const blocked = keys
    .map((key) => {
      const matching = attempts.filter(
        (attempt) =>
          attempt.scope === key.scope &&
          attempt.keyHash === key.keyHash
      );

      return matching.length >= key.limit
        ? matching.reduce(
            (earliest, attempt) =>
              attempt.attemptedAt < earliest
                ? attempt.attemptedAt
                : earliest,
            matching[0].attemptedAt
          )
        : null;
    })
    .filter((value): value is Date => value !== null);

  if (blocked.length === 0) return { limited: false };

  const retryAt = new Date(
    Math.min(...blocked.map((attemptedAt) => attemptedAt.getTime())) +
      WINDOW_MS
  );

  return {
    limited: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((retryAt.getTime() - now.getTime()) / 1000)
    ),
  };
}

export async function recordLoginResult({
  email,
  ip,
  succeeded,
}: {
  email: string;
  ip: string | null;
  succeeded: boolean;
}): Promise<RateLimitResult> {
  const keys = scopeKeys(email, ip);
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      await lockKeys(tx, keys);
      const limit = await inspectLockedAttempts(tx, keys, now);

      if (limit.limited) return limit;

      const account = keys[0];

      if (succeeded) {
        await tx.loginAttempt.deleteMany({
          where: {
            scope: account.scope,
            keyHash: account.keyHash,
          },
        });
      } else {
        await tx.loginAttempt.createMany({
          data: keys.map((key) => ({
            scope: key.scope,
            keyHash: key.keyHash,
            attemptedAt: now,
          })),
        });
      }

      return { limited: false };
    },
    { isolationLevel: "Serializable" }
  );
}

export const loginRateLimitPolicy = {
  accountLimit: ACCOUNT_LIMIT,
  ipLimit: IP_LIMIT,
  windowMs: WINDOW_MS,
};
