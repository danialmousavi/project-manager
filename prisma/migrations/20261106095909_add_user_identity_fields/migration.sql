/*
  Warnings:

  - A unique constraint covering the columns `[nationalId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
