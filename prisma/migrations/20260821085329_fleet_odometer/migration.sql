-- AlterTable
ALTER TABLE "fleet_trips" ADD COLUMN     "odometer" INTEGER,
ADD COLUMN     "odometerDelta" INTEGER,
ADD COLUMN     "odometerStatus" TEXT NOT NULL DEFAULT 'OK';

-- CreateIndex
CREATE INDEX "fleet_trips_odometerStatus_idx" ON "fleet_trips"("odometerStatus");
