-- AlterTable
ALTER TABLE "Society" ADD COLUMN     "cashReceiptSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CashCollection" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "receiptNo" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receivedOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "depositId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDeposit" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "depositedById" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "depositedOn" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashCollection_societyId_depositId_idx" ON "CashCollection"("societyId", "depositId");

-- CreateIndex
CREATE INDEX "CashCollection_collectedById_idx" ON "CashCollection"("collectedById");

-- CreateIndex
CREATE UNIQUE INDEX "CashCollection_societyId_receiptNo_key" ON "CashCollection"("societyId", "receiptNo");

-- CreateIndex
CREATE INDEX "CashDeposit_societyId_depositedOn_idx" ON "CashDeposit"("societyId", "depositedOn");

-- AddForeignKey
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "CashDeposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDeposit" ADD CONSTRAINT "CashDeposit_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDeposit" ADD CONSTRAINT "CashDeposit_depositedById_fkey" FOREIGN KEY ("depositedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDeposit" ADD CONSTRAINT "CashDeposit_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
