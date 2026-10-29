-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('FLATS', 'RESIDENTS', 'DUES', 'EXPENSES');

-- AlterTable
ALTER TABLE "MaintenancePayment" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "createdById" TEXT NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_societyId_createdAt_idx" ON "ImportBatch"("societyId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenancePayment_importBatchId_idx" ON "MaintenancePayment"("importBatchId");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

