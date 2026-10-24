-- CreateEnum
CREATE TYPE "MoneyChannel" AS ENUM ('BANK', 'CASH');

-- AlterTable
ALTER TABLE "CashDeposit" ADD COLUMN     "bankAccountId" TEXT;

-- AlterTable
ALTER TABLE "CreditEntry" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "channel" "MoneyChannel" NOT NULL DEFAULT 'BANK';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "paidVia" "MoneyChannel" NOT NULL DEFAULT 'BANK';

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "receivedVia" "MoneyChannel" NOT NULL DEFAULT 'BANK';

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "last4" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "openingDate" TIMESTAMP(3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalanceCheck" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "statementBalance" DECIMAL(12,2) NOT NULL,
    "expectedBalance" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankBalanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_societyId_idx" ON "BankAccount"("societyId");

-- CreateIndex
CREATE INDEX "BankBalanceCheck_societyId_bankAccountId_asOf_idx" ON "BankBalanceCheck"("societyId", "bankAccountId", "asOf");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceCheck" ADD CONSTRAINT "BankBalanceCheck_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceCheck" ADD CONSTRAINT "BankBalanceCheck_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceCheck" ADD CONSTRAINT "BankBalanceCheck_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDeposit" ADD CONSTRAINT "CashDeposit_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cash receipts were recorded as deposits with this note; mark them so they are not counted as money in the bank.
UPDATE "CreditEntry" SET "channel" = 'CASH' WHERE "type" = 'DEPOSIT' AND "note" = 'Cash received';
