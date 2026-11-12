CREATE TABLE "SprintEndSnapshot" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedTaskCount" INTEGER NOT NULL,
    "completedTaskCount" INTEGER NOT NULL,
    "incompleteTaskCount" INTEGER NOT NULL,
    "plannedStoryPoints" INTEGER NOT NULL,
    "completedStoryPoints" INTEGER NOT NULL,
    "incompleteStoryPoints" INTEGER NOT NULL,
    "movedToSprintId" TEXT,

    CONSTRAINT "SprintEndSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintEndSnapshot_sprintId_key" ON "SprintEndSnapshot"("sprintId");
CREATE INDEX "SprintEndSnapshot_movedToSprintId_idx" ON "SprintEndSnapshot"("movedToSprintId");

ALTER TABLE "SprintEndSnapshot"
  ADD CONSTRAINT "SprintEndSnapshot_sprintId_fkey"
  FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
