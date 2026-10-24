-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('VERIFY_EMAIL', 'VERIFY_PHONE', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('DUE_CREATED', 'DUE_REMINDER', 'MANUAL_REMINDER', 'PAYMENT_RECEIPT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "Channel" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "userId" TEXT,
    "paymentId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "channel" "Channel" NOT NULL,
    "to" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpCode_target_purpose_createdAt_idx" ON "OtpCode"("target", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_userId_idx" ON "OtpCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationLog_societyId_createdAt_idx" ON "NotificationLog"("societyId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_paymentId_idx" ON "NotificationLog"("paymentId");

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
