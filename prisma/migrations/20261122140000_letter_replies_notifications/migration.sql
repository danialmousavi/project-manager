ALTER TYPE "NotificationType" ADD VALUE 'LETTER_RECEIVED';
ALTER TABLE "Letter" ADD COLUMN "replyToId" TEXT;
CREATE INDEX "Letter_replyToId_idx" ON "Letter"("replyToId");
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Letter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
