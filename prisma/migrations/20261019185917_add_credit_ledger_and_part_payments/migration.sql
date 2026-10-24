-- CreateEnum
CREATE TYPE "CreditEntryType" AS ENUM ('DEPOSIT', 'APPLIED', 'REVERSAL');

-- AlterTable
ALTER TABLE "MaintenancePayment" ADD COLUMN     "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentId" TEXT,
    "claimId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditEntry_societyId_userId_idx" ON "CreditEntry"("societyId", "userId");

-- CreateIndex
CREATE INDEX "CreditEntry_paymentId_idx" ON "CreditEntry"("paymentId");

-- CreateIndex
CREATE INDEX "CreditEntry_claimId_idx" ON "CreditEntry"("claimId");

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing PAID dues were paid in full
UPDATE "MaintenancePayment" SET "amountPaid" = "amount" WHERE "status" = 'PAID';
