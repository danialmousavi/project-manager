CREATE TYPE "TaskType" AS ENUM ('STORY', 'TASK', 'BUG');

ALTER TABLE "Task"
  ADD COLUMN "type" "TaskType" NOT NULL DEFAULT 'TASK',
  ADD COLUMN "storyPoints" INTEGER,
  ADD COLUMN "rank" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "acceptanceCriteria" TEXT;

CREATE INDEX "Task_projectId_rank_idx" ON "Task"("projectId", "rank");
