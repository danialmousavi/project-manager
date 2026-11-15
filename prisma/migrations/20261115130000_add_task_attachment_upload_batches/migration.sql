ALTER TABLE "TaskAttachment" ADD COLUMN "uploadBatchId" TEXT;

CREATE INDEX "TaskAttachment_taskId_uploadBatchId_createdAt_idx"
ON "TaskAttachment"("taskId", "uploadBatchId", "createdAt");
