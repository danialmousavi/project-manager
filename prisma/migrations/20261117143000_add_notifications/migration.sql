-- In-app notifications, shared by project events now and chat events later.
CREATE TYPE "NotificationType" AS ENUM (
  'TASK_ASSIGNED',
  'TASK_UPDATED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'TASK_COMMENTED',
  'TASK_MENTIONED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'SPRINT_STARTED',
  'SPRINT_COMPLETED',
  'SPRINT_TASK_MOVED'
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT NOT NULL,
  "payload" JSONB,
  "dedupeKey" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key"
ON "Notification"("userId", "dedupeKey");

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
ON "Notification"("userId", "readAt", "createdAt");

CREATE INDEX "Notification_projectId_createdAt_idx"
ON "Notification"("projectId", "createdAt");

CREATE INDEX "Notification_type_createdAt_idx"
ON "Notification"("type", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
