-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'PAYMENT_PROOF';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "claimId" TEXT;

-- CreateIndex
CREATE INDEX "Document_claimId_idx" ON "Document"("claimId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PaymentClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
