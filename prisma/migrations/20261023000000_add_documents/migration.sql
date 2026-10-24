-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('BILL', 'TAX_RECEIPT', 'AGREEMENT', 'INSURANCE', 'MINUTES', 'BYLAWS', 'NOTICE', 'AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('COMMITTEE', 'RESIDENTS');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'READY', 'DELETED');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'COMMITTEE',
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresOn" TIMESTAMP(3),
    "retainUntil" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_societyId_status_category_idx" ON "Document"("societyId", "status", "category");

-- CreateIndex
CREATE INDEX "Document_societyId_expiresOn_idx" ON "Document"("societyId", "expiresOn");

-- CreateIndex
CREATE INDEX "Document_status_createdAt_idx" ON "Document"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
