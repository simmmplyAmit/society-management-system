-- CreateEnum
CREATE TYPE "UpiChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Society" ADD COLUMN     "upiChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UpiChangeRequest" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "oldUpiId" TEXT,
    "newUpiId" TEXT NOT NULL,
    "status" "UpiChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpiChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpiChangeRequest_societyId_status_idx" ON "UpiChangeRequest"("societyId", "status");

-- CreateIndex
CREATE INDEX "UpiChangeRequest_societyId_createdAt_idx" ON "UpiChangeRequest"("societyId", "createdAt");

-- AddForeignKey
ALTER TABLE "UpiChangeRequest" ADD CONSTRAINT "UpiChangeRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiChangeRequest" ADD CONSTRAINT "UpiChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiChangeRequest" ADD CONSTRAINT "UpiChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
