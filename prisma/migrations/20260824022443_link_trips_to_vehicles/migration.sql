-- AlterTable
ALTER TABLE "fleet_trips" ADD COLUMN     "vehicleRefId" TEXT;

-- AddForeignKey
ALTER TABLE "fleet_trips" ADD CONSTRAINT "fleet_trips_vehicleRefId_fkey" FOREIGN KEY ("vehicleRefId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
