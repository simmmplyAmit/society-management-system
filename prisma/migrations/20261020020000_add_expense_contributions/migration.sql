-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditEntryType" ADD VALUE 'EXPENSE_CREDIT';
ALTER TYPE "CreditEntryType" ADD VALUE 'EXPENSE_CREDIT_REVERSAL';

-- AlterTable
ALTER TABLE "CreditEntry" ADD COLUMN     "expenseId" TEXT;

-- CreateTable
CREATE TABLE "ExpenseContribution" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "expenseId" TEXT,
    "expenseTitle" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseContribution_societyId_status_idx" ON "ExpenseContribution"("societyId", "status");

-- CreateIndex
CREATE INDEX "ExpenseContribution_expenseId_idx" ON "ExpenseContribution"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseContribution_userId_idx" ON "ExpenseContribution"("userId");

-- CreateIndex
CREATE INDEX "CreditEntry_expenseId_idx" ON "CreditEntry"("expenseId");

-- AddForeignKey
ALTER TABLE "ExpenseContribution" ADD CONSTRAINT "ExpenseContribution_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseContribution" ADD CONSTRAINT "ExpenseContribution_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseContribution" ADD CONSTRAINT "ExpenseContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseContribution" ADD CONSTRAINT "ExpenseContribution_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseContribution" ADD CONSTRAINT "ExpenseContribution_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
