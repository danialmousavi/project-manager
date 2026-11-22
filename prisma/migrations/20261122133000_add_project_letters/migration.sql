CREATE TABLE "Letter" ("id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Letter_pkey" PRIMARY KEY ("id"));
CREATE TABLE "LetterRecipient" ("letterId" TEXT NOT NULL, "userId" TEXT NOT NULL, "readAt" TIMESTAMP(3), CONSTRAINT "LetterRecipient_pkey" PRIMARY KEY ("letterId", "userId"));
CREATE INDEX "Letter_projectId_createdAt_idx" ON "Letter"("projectId", "createdAt");
CREATE INDEX "LetterRecipient_userId_readAt_idx" ON "LetterRecipient"("userId", "readAt");
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LetterRecipient" ADD CONSTRAINT "LetterRecipient_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
