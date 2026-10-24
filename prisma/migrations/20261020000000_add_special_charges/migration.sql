-- CreateEnum
CREATE TYPE "ChargeBasis" AS ENUM ('FIXED', 'PER_SQFT');

-- CreateEnum
CREATE TYPE "ChargeSchedule" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "ChargeFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- DropIndex
DROP INDEX "MaintenancePayment_flatId_month_year_key";

-- AlterTable
ALTER TABLE "Flat" ADD COLUMN     "areaSqFt" DECIMAL(8,2),
ADD COLUMN     "configuration" TEXT;

-- AlterTable
ALTER TABLE "MaintenancePayment" ADD COLUMN     "chargeKey" TEXT NOT NULL DEFAULT 'MAINTENANCE',
ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'Maintenance',
ADD COLUMN     "specialChargeId" TEXT,
ALTER COLUMN "chargeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SpecialCharge" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basis" "ChargeBasis" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "schedule" "ChargeSchedule" NOT NULL,
    "frequency" "ChargeFrequency",
    "startMonth" INTEGER NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endMonth" INTEGER,
    "endYear" INTEGER,
    "configurations" TEXT[],
    "minArea" DECIMAL(8,2),
    "maxArea" DECIMAL(8,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialCharge_societyId_isActive_idx" ON "SpecialCharge"("societyId", "isActive");

-- CreateIndex
CREATE INDEX "MaintenancePayment_specialChargeId_idx" ON "MaintenancePayment"("specialChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenancePayment_flatId_month_year_chargeKey_key" ON "MaintenancePayment"("flatId", "month", "year", "chargeKey");

-- AddForeignKey
ALTER TABLE "MaintenancePayment" ADD CONSTRAINT "MaintenancePayment_specialChargeId_fkey" FOREIGN KEY ("specialChargeId") REFERENCES "SpecialCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialCharge" ADD CONSTRAINT "SpecialCharge_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialCharge" ADD CONSTRAINT "SpecialCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
