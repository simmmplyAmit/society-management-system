-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "expenseId" TEXT,
ADD COLUMN     "incomeId" TEXT;

-- CreateIndex
CREATE INDEX "Document_expenseId_idx" ON "Document"("expenseId");

-- CreateIndex
CREATE INDEX "Document_incomeId_idx" ON "Document"("incomeId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;
