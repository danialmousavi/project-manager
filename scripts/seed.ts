import "dotenv/config";

import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/password";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const name = process.env.ADMIN_NAME?.trim() || "System Admin";
  const email = process.env.ADMIN_EMAIL?.trim() || "admin@example.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  const generatedPassword =
    !existing && !configuredPassword
      ? randomBytes(24).toString("base64url")
      : undefined;
  const password = configuredPassword || generatedPassword;

  const passwordHash = password ? await hashPassword(password) : undefined;

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "ADMIN",
      isActive: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      name,
      email,
      passwordHash: passwordHash!,
      role: "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log("Admin user created/updated:", admin);

  if (generatedPassword) {
    console.log("Generated ADMIN password (save it now):", generatedPassword);
  } else if (!configuredPassword && existing) {
    console.log("Existing ADMIN password was preserved.");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
