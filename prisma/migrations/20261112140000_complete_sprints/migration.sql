-- Keep existing sprint records while adopting the Scrum name for future sprints.
ALTER TYPE "SprintStatus" RENAME VALUE 'PLANNED' TO 'FUTURE';

CREATE TABLE "SprintStartSnapshot" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedTaskCount" INTEGER NOT NULL,
    "plannedStoryPoints" INTEGER NOT NULL,

    CONSTRAINT "SprintStartSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SprintStartSnapshotTask" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "storyPoints" INTEGER,
    "rank" DOUBLE PRECISION NOT NULL,
    "statusAtStart" "TaskStatus" NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintStartSnapshotTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintStartSnapshot_sprintId_key" ON "SprintStartSnapshot"("sprintId");
CREATE UNIQUE INDEX "SprintStartSnapshotTask_snapshotId_taskId_key" ON "SprintStartSnapshotTask"("snapshotId", "taskId");
CREATE INDEX "SprintStartSnapshotTask_taskId_idx" ON "SprintStartSnapshotTask"("taskId");
CREATE UNIQUE INDEX "Sprint_one_active_per_project" ON "Sprint"("projectId") WHERE "status" = 'ACTIVE';

ALTER TABLE "SprintStartSnapshot"
  ADD CONSTRAINT "SprintStartSnapshot_sprintId_fkey"
  FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SprintStartSnapshotTask"
  ADD CONSTRAINT "SprintStartSnapshotTask_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SprintStartSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
