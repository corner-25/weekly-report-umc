-- Ingestion layer: đồng bộ dữ liệu tự động từ OneDrive, Google Sheets
-- Xem docs/INGESTION-REFACTOR.md

-- CreateEnum
CREATE TYPE "SyncSourceKind" AS ENUM ('ONEDRIVE_SHARE', 'GOOGLE_SHEETS', 'GITHUB_JSON', 'HTTP_API');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PendingImportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "sync_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SyncSourceKind" NOT NULL,
    "config" JSONB NOT NULL,
    "cronEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastChecksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsRead" INTEGER NOT NULL DEFAULT 0,
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_ai_imports" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" "PendingImportStatus" NOT NULL DEFAULT 'PENDING',
    "syncRunId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_ai_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hc_metrics" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "month" INTEGER,
    "value" DOUBLE PRECISION NOT NULL,
    "sourceId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hc_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_trips" (
    "id" TEXT NOT NULL,
    "sourceRowHash" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "durationHours" DOUBLE PRECISION,
    "durationSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "distanceKm" DOUBLE PRECISION,
    "distanceFixMethod" TEXT,
    "fuelLiters" DOUBLE PRECISION,
    "revenueVnd" DOUBLE PRECISION,
    "destination" TEXT NOT NULL,
    "workCategory" TEXT NOT NULL,
    "areaType" TEXT NOT NULL,
    "tripDetails" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_runs_sourceId_startedAt_idx" ON "sync_runs"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "sync_runs_startedAt_idx" ON "sync_runs"("startedAt");

-- CreateIndex
CREATE INDEX "sync_logs_runId_idx" ON "sync_logs"("runId");

-- CreateIndex
CREATE INDEX "pending_ai_imports_status_idx" ON "pending_ai_imports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pending_ai_imports_sourceId_year_week_key" ON "pending_ai_imports"("sourceId", "year", "week");

-- CreateIndex
CREATE INDEX "hc_metrics_year_week_idx" ON "hc_metrics"("year", "week");

-- CreateIndex
CREATE INDEX "hc_metrics_category_idx" ON "hc_metrics"("category");

-- CreateIndex
CREATE UNIQUE INDEX "hc_metrics_category_content_year_week_key" ON "hc_metrics"("category", "content", "year", "week");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_trips_sourceRowHash_key" ON "fleet_trips"("sourceRowHash");

-- CreateIndex
CREATE INDEX "fleet_trips_recordDate_idx" ON "fleet_trips"("recordDate");

-- CreateIndex
CREATE INDEX "fleet_trips_vehicleId_recordDate_idx" ON "fleet_trips"("vehicleId", "recordDate");

-- CreateIndex
CREATE INDEX "fleet_trips_driverName_idx" ON "fleet_trips"("driverName");

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sync_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_ai_imports" ADD CONSTRAINT "pending_ai_imports_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sync_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
