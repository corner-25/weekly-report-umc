/*
  Warnings:

  - You are about to drop the column `licenseId` on the `vehicles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_licenseId_fkey";

-- DropIndex
DROP INDEX "vehicles_licenseId_key";

-- AlterTable
ALTER TABLE "licenses" ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "licenseId";

-- CreateIndex
CREATE INDEX "licenses_vehicleId_idx" ON "licenses"("vehicleId");

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
