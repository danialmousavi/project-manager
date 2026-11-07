import "dotenv/config";

import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const requiredEnv = ["ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]?.trim()) {
    throw new Error(`${key} environment variable is required`);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await argon2.hash(process.env.ADMIN_PASSWORD!);

  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL! },
    update: {
      name: process.env.ADMIN_NAME!,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      name: process.env.ADMIN_NAME!,
      email: process.env.ADMIN_EMAIL!,
      passwordHash,
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
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
