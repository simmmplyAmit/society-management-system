-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Document_tags_idx" ON "Document" USING GIN ("tags");
