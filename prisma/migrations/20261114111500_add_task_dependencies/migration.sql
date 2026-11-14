CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "dependentTaskId" TEXT NOT NULL,
    "prerequisiteTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskDependency_dependentTaskId_prerequisiteTaskId_key"
ON "TaskDependency"("dependentTaskId", "prerequisiteTaskId");

CREATE INDEX "TaskDependency_prerequisiteTaskId_idx"
ON "TaskDependency"("prerequisiteTaskId");

ALTER TABLE "TaskDependency"
ADD CONSTRAINT "TaskDependency_dependentTaskId_fkey"
FOREIGN KEY ("dependentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDependency"
ADD CONSTRAINT "TaskDependency_prerequisiteTaskId_fkey"
FOREIGN KEY ("prerequisiteTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
