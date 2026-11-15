-- CreateEnum
CREATE TYPE "OvertimeWorkMode" AS ENUM ('ONSITE', 'REMOTE');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('RUNNING', 'PAUSED', 'SAVED');

-- CreateTable
CREATE TABLE "OvertimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workMode" "OvertimeWorkMode" NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'RUNNING',
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeSegment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimeEntry_userId_status_idx" ON "OvertimeEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "OvertimeEntry_userId_savedAt_idx" ON "OvertimeEntry"("userId", "savedAt");

-- CreateIndex
CREATE INDEX "OvertimeSegment_entryId_startedAt_idx" ON "OvertimeSegment"("entryId", "startedAt");

-- A user may have only one unfinished overtime record, across all browser tabs.
CREATE UNIQUE INDEX "OvertimeEntry_one_draft_per_user" ON "OvertimeEntry"("userId") WHERE "status" IN ('RUNNING', 'PAUSED');

-- A record may have only one currently running segment.
CREATE UNIQUE INDEX "OvertimeSegment_one_open_segment_per_entry" ON "OvertimeSegment"("entryId") WHERE "stoppedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeSegment" ADD CONSTRAINT "OvertimeSegment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "OvertimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
