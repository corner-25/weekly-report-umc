-- Phân hệ Quản lý công việc: theo dõi chỉ đạo của BGĐ và việc theo kế hoạch.
-- Chỉ thêm bảng mới, không đụng dữ liệu cũ.

-- CreateEnum
CREATE TYPE "WorkSource" AS ENUM ('QLCV', 'MANUAL');
CREATE TYPE "WorkKind" AS ENUM ('DIRECTIVE', 'PLAN', 'OTHER');
CREATE TYPE "WorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED');
CREATE TYPE "WorkPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "work_items" (
    "id" TEXT NOT NULL,
    "source" "WorkSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "kind" "WorkKind" NOT NULL DEFAULT 'DIRECTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "directedBy" TEXT,
    "directedAt" DATE,
    "leadUnit" TEXT,
    "departmentId" TEXT,
    "coordinatingUnits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" DATE,
    "status" "WorkStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "externalStatus" TEXT,
    "progressPercent" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "priority" "WorkPriority" NOT NULL DEFAULT 'NORMAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "characteristics" TEXT,
    "notes" TEXT,
    "aiPlan" JSONB,
    "aiAssessment" JSONB,
    "aiUpdatedAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_updates" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "source" "WorkSource" NOT NULL DEFAULT 'MANUAL',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "author" TEXT,
    "content" TEXT NOT NULL,
    "progressPercent" INTEGER,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_updates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_import_runs" (
    "id" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredBy" TEXT,
    "itemsSeen" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsChanged" INTEGER NOT NULL DEFAULT 0,
    "updatesAdded" INTEGER NOT NULL DEFAULT 0,
    "problems" JSONB,

    CONSTRAINT "work_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_items_source_externalId_key" ON "work_items"("source", "externalId");
CREATE INDEX "work_items_status_lastActivityAt_idx" ON "work_items"("status", "lastActivityAt");
CREATE INDEX "work_items_departmentId_idx" ON "work_items"("departmentId");
CREATE INDEX "work_items_dueDate_idx" ON "work_items"("dueDate");
CREATE UNIQUE INDEX "work_updates_workItemId_contentHash_key" ON "work_updates"("workItemId", "contentHash");
CREATE INDEX "work_updates_occurredAt_idx" ON "work_updates"("occurredAt");
CREATE INDEX "work_import_runs_importedAt_idx" ON "work_import_runs"("importedAt");

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_updates" ADD CONSTRAINT "work_updates_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
