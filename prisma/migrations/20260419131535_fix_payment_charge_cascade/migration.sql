-- DropForeignKey
ALTER TABLE "MaintenancePayment" DROP CONSTRAINT "MaintenancePayment_chargeId_fkey";

-- AddForeignKey
ALTER TABLE "MaintenancePayment" ADD CONSTRAINT "MaintenancePayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "MaintenanceCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
