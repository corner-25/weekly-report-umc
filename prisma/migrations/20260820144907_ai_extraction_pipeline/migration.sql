-- CreateEnum
CREATE TYPE "ProgressMeaning" AS ENUM ('COMPLETION', 'WEEKLY_DONE', 'TIME_RATIO', 'MEANINGLESS');

-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('WEEK', 'CUMULATIVE', 'MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EDITED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProgressType" ADD VALUE 'MILESTONE';
ALTER TYPE "ProgressType" ADD VALUE 'MONITORING';
ALTER TYPE "ProgressType" ADD VALUE 'UNRELIABLE';

-- AlterTable
ALTER TABLE "master_tasks" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "firstSeenWeek" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeenWeek" INTEGER,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "progressMeaning" "ProgressMeaning" NOT NULL DEFAULT 'WEEKLY_DONE',
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "week_task_progress" ADD COLUMN     "extractionModel" TEXT,
ADD COLUMN     "matchConfidence" DOUBLE PRECISION,
ADD COLUMN     "matchReasoning" TEXT,
ADD COLUMN     "rawResultText" TEXT,
ADD COLUMN     "rawTaskName" TEXT,
ADD COLUMN     "reviewFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "subject" TEXT;

-- CreateTable
CREATE TABLE "extracted_metrics" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "masterTaskId" TEXT,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "period" "MetricPeriod" NOT NULL DEFAULT 'WEEK',
    "asOfDate" TIMESTAMP(3),
    "sourceText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "originalValue" DOUBLE PRECISION,
    "extractionModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_extraction_runs" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "departmentId" TEXT,
    "year" INTEGER,
    "week" INTEGER,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "itemsInput" INTEGER NOT NULL DEFAULT 0,
    "itemsOutput" INTEGER NOT NULL DEFAULT 0,
    "flagged" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_extraction_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extracted_metrics_weekId_departmentId_idx" ON "extracted_metrics"("weekId", "departmentId");

-- CreateIndex
CREATE INDEX "extracted_metrics_name_idx" ON "extracted_metrics"("name");

-- CreateIndex
CREATE INDEX "extracted_metrics_reviewStatus_idx" ON "extracted_metrics"("reviewStatus");

-- CreateIndex
CREATE INDEX "ai_extraction_runs_stage_createdAt_idx" ON "ai_extraction_runs"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "ai_extraction_runs_departmentId_year_week_idx" ON "ai_extraction_runs"("departmentId", "year", "week");

-- CreateIndex
CREATE INDEX "master_tasks_parentId_idx" ON "master_tasks"("parentId");

-- AddForeignKey
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "master_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_metrics" ADD CONSTRAINT "extracted_metrics_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_metrics" ADD CONSTRAINT "extracted_metrics_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_metrics" ADD CONSTRAINT "extracted_metrics_masterTaskId_fkey" FOREIGN KEY ("masterTaskId") REFERENCES "master_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
