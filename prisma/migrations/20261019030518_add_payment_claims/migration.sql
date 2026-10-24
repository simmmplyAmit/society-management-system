-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MaintenancePayment" ADD COLUMN     "claimId" TEXT;

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "utrNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentClaim_societyId_status_idx" ON "PaymentClaim"("societyId", "status");

-- CreateIndex
CREATE INDEX "PaymentClaim_userId_idx" ON "PaymentClaim"("userId");

-- CreateIndex
CREATE INDEX "PaymentClaim_societyId_utrNumber_idx" ON "PaymentClaim"("societyId", "utrNumber");

-- CreateIndex
CREATE INDEX "MaintenancePayment_claimId_idx" ON "MaintenancePayment"("claimId");

-- AddForeignKey
ALTER TABLE "MaintenancePayment" ADD CONSTRAINT "MaintenancePayment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PaymentClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
