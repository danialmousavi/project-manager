-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'EXPERT', 'CONTROLLER');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'EXPERT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "Project" ADD COLUMN "companyId" TEXT;

-- Create the tenant that owns all records created before multi-company support.
INSERT INTO "Company" ("id", "name", "status", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000000', 'سازمان پیش‌فرض', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Preserve all existing projects and users inside the default company.
UPDATE "Project"
SET "companyId" = '00000000-0000-4000-8000-000000000000';

INSERT INTO "CompanyMember" ("id", "companyId", "userId", "role", "isActive", "joinedAt")
SELECT
    md5('default-company:' || "id"),
    '00000000-0000-4000-8000-000000000000',
    "id",
    CASE "role"
        WHEN 'ADMIN' THEN 'OWNER'::"CompanyMemberRole"
        WHEN 'MANAGER' THEN 'PROJECT_MANAGER'::"CompanyMemberRole"
        WHEN 'CONTROLLER' THEN 'CONTROLLER'::"CompanyMemberRole"
        ELSE 'EXPERT'::"CompanyMemberRole"
    END,
    "isActive",
    "createdAt"
FROM "User";

-- Make the company boundary mandatory after backfilling legacy records.
ALTER TABLE "Project" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");
CREATE INDEX "Company_status_idx" ON "Company"("status");
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");
CREATE INDEX "CompanyMember_userId_isActive_idx" ON "CompanyMember"("userId", "isActive");
CREATE INDEX "CompanyMember_companyId_role_isActive_idx" ON "CompanyMember"("companyId", "role", "isActive");
CREATE INDEX "Project_companyId_archivedAt_idx" ON "Project"("companyId", "archivedAt");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
